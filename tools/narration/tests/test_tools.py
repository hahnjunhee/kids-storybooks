"""낭독 도구(make_adapter.py, verify.py) 단위 시험. 저장소 루트에서: python tools/narration/tests/test_tools.py
요건: beautifulsoup4. 합성·브라우저 없이 동작한다."""
import json
import os
import subprocess
import sys
import tempfile
import unittest

ROOT = os.path.abspath(os.path.join(os.path.dirname(__file__), "..", "..", ".."))
MAKE = os.path.join(ROOT, "tools", "narration", "make_adapter.py")
VERIFY = os.path.join(ROOT, "tools", "narration", "verify.py")

BOOK = """<!doctype html><html lang="ko"><head><meta charset="utf-8"><title>t</title></head><body><header></header>
<main>
<section class="spread" id="scene0"><div class="illustration"><img alt="a" src="x"></div><div class="copy"><h1>제목</h1><div class="story"><p>표지 소개</p></div></div></section>
<section class="spread" id="scene1"><div class="copy"><h2>첫 장</h2><div class="story"><p>숲에 갔어요.</p><p>키가 120센티미터예요.</p></div></div></section>
<section class="spread" id="scene2"><div class="copy"><h2>둘째 장</h2><div class="story"><p>집에 왔어요.</p></div></div></section>
%s
</main></body></html>"""
NOTES = '<section class="activity" id="notes"><h2>노트</h2><div class="story"><p>12가지</p></div></section>'


def rd(path):
    with open(path, encoding="utf8") as f:
        return f.read()


def wr(path, text):
    with open(path, "w", encoding="utf8") as f:
        f.write(text)


def run(args, **kw):
    return subprocess.run([sys.executable] + args, capture_output=True, text=True, cwd=ROOT, **kw)


class MakeAdapter(unittest.TestCase):
    def setUp(self):
        self.d = tempfile.mkdtemp()
        self.html = os.path.join(self.d, "b.html")
        self.out = os.path.join(self.d, "ad.json")

    def book(self, extra=NOTES, text=None):
        s = BOOK % extra
        if text:
            s = s.replace(*text)
        wr(self.html, s)

    def make(self, *extra):
        return run([MAKE, "--html", self.html, "--book-id", "tbook", "--out", self.out, *extra])

    def load(self):
        return json.loads(rd(self.out))

    def test_creates_adapter_and_excludes_activity(self):
        self.book()
        r = self.make()
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        ad = self.load()
        self.assertEqual([s["scene_id"] for s in ad["scenes"]], ["scene0", "scene1", "scene2"])
        self.assertEqual(ad["scenes"][0]["paragraphs"], [])  # 표지 소개 제외
        self.assertIn("낭독 제외: <section#notes.activity>", r.stdout)

    def test_refuses_to_overwrite_without_update(self):
        self.book()
        self.make()
        ad = self.load()
        ad["pronunciation"] = [["120센티미터", "백이십 센티미터"]]
        wr(self.out, json.dumps(ad, ensure_ascii=False))
        before = rd(self.out)
        r = self.make()
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(rd(self.out), before)  # 파일 불변

    def test_update_preserves_pronunciation_review_and_extra_keys(self):
        self.book()
        self.make()
        ad = self.load()
        ad["pronunciation"] = [["120센티미터", "백이십 센티미터"]]
        ad["pronunciation_review"][0].update(status="reviewed", note="청취 확인")
        ad["size_exception"] = "삽화 품질 유지"
        ad["custom_key"] = {"a": 1}
        wr(self.out, json.dumps(ad, ensure_ascii=False))
        r = self.make("--update")
        self.assertEqual(r.returncode, 0, r.stderr + r.stdout)
        new = self.load()
        self.assertEqual(new["pronunciation"], [["120센티미터", "백이십 센티미터"]])
        self.assertEqual(new["pronunciation_review"][0]["status"], "reviewed")
        self.assertEqual(new["pronunciation_review"][0]["note"], "청취 확인")
        self.assertEqual(new["size_exception"], "삽화 품질 유지")
        self.assertEqual(new["custom_key"], {"a": 1})

    def test_flagged_unit_starts_pending_and_stale_after_text_change(self):
        self.book()
        self.make()
        rev = self.load()["pronunciation_review"]
        self.assertEqual(len(rev), 1)
        self.assertEqual(rev[0]["status"], "pending")
        self.assertEqual(rev[0]["scene_id"], "scene1")
        # 본문 변경: 기존 검수 기록은 무효, 새 단위는 pending
        rev[0]["status"] = "reviewed"
        ad = self.load(); ad["pronunciation_review"] = rev
        wr(self.out, json.dumps(ad, ensure_ascii=False))
        self.book(text=("120센티미터", "130센티미터"))
        r = self.make("--update")
        self.assertEqual(r.returncode, 0)
        self.assertIn("검수 기록이 무효", r.stdout)
        new = self.load()["pronunciation_review"]
        self.assertEqual(len(new), 1)
        self.assertEqual(new[0]["status"], "pending")

    def test_rogue_section_is_an_error_not_silently_skipped(self):
        for extra in ['<section class="bonus"><h2>보너스</h2><p>x</p></section>',   # 규약 밖 class
                      '<section><h2>id 없음</h2></section>',                       # id 없음
                      '<section id="extra1"><h2>다른 id</h2></section>',           # scene 아닌 id
                      '<div class="spread"><img alt="a" src="x"><div class="story"><p>섹션 아님</p></div></div>']:
            self.book(extra=NOTES + extra)
            r = self.make()
            self.assertNotEqual(r.returncode, 0, extra)
            self.assertIn("오류", r.stdout, extra)
            self.assertFalse(os.path.exists(self.out), extra)

    def test_non_consecutive_scene_ids_are_an_error(self):
        self.book(text=('id="scene2"', 'id="scene5"'))
        r = self.make()
        self.assertNotEqual(r.returncode, 0)
        self.assertIn("scene0부터 빠짐없이", r.stdout)

    def test_error_during_update_keeps_existing_file(self):
        self.book(); self.make()
        before = rd(self.out)
        self.book(extra=NOTES + '<section class="bonus"><h2>x</h2></section>')
        r = self.make("--update")
        self.assertNotEqual(r.returncode, 0)
        self.assertEqual(rd(self.out), before)

    def test_custom_selectors_for_non_template_books(self):
        html = BOOK.replace("<h1>제목</h1>", "<h2>제목</h2>").replace('<div class="story"><p>숲에 갔어요.</p>', '<p class="lead">“안녕!”</p><div class="story"><p>숲에 갔어요.</p>') % NOTES
        wr(self.html, html)
        r = self.make("--cover-heading", "h2", "--paragraphs", ".lead,.story p")
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        ad = self.load()
        self.assertEqual(ad["scenes"][0]["heading"], "h2")
        self.assertEqual(ad["scenes"][1]["paragraphs"], [".lead", ".story p"])
        # 기본 선택자로는 표지 h1이 없어 오류
        wr(self.html, html)
        r2 = run([MAKE, "--html", self.html, "--book-id", "tbook", "--out", self.out + "2"])
        self.assertNotEqual(r2.returncode, 0)

    def test_book_id_must_be_slug_and_match_on_update(self):
        self.book()
        r = run([MAKE, "--html", self.html, "--book-id", "Bad_ID", "--out", self.out])
        self.assertNotEqual(r.returncode, 0)
        self.make()
        r = run([MAKE, "--html", self.html, "--book-id", "other", "--out", self.out, "--update"])
        self.assertNotEqual(r.returncode, 0)


class VerifySize(unittest.TestCase):
    TEMPLATE = os.path.join("templates", "storybook.html")

    def test_modes_only_size_budget(self):
        ok = run([VERIFY, "--modes-only", self.TEMPLATE, "--max-html-bytes", "500000"])
        self.assertEqual(ok.returncode, 0, ok.stdout)
        self.assertIn("최종 HTML 용량 목표", ok.stdout)
        bad = run([VERIFY, "--modes-only", self.TEMPLATE, "--max-html-bytes", "1000"])
        self.assertEqual(bad.returncode, 1)
        self.assertIn("FAIL 최종 HTML 용량 목표", bad.stdout)

    def test_template_matches_convention(self):  # 템플릿은 자기 규약을 지켜야 한다
        d = tempfile.mkdtemp()
        out = os.path.join(d, "t.json")
        r = run([MAKE, "--html", self.TEMPLATE, "--book-id", "template-sample", "--out", out])
        self.assertEqual(r.returncode, 0, r.stdout + r.stderr)
        self.assertEqual(len(json.loads(rd(out))["scenes"]), 3)


if __name__ == "__main__":
    unittest.main(verbosity=1)
