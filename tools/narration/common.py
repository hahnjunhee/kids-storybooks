"""낭독 도구 공용 규칙: 어댑터 로드, 장면 본문 추출, 정규화, 해시.

브라우저의 플레이어(player.js)와 같은 규칙을 써야 text_hash가 일치한다.
- 정규화: 연속 공백을 한 칸으로, 앞뒤 공백 제거, 유니코드 NFC.
- 장면 단위(unit): 제목 1개 + 본문 문단들. 장면 본문은 단위를 '\\n'으로 이어 붙인다.
"""
import hashlib
import json
import re
import unicodedata

from bs4 import BeautifulSoup

PLAYER_VERSION = "1.1.0"
SCHEMA_VERSION = 1


def norm(text):
    return unicodedata.normalize("NFC", re.sub(r"\s+", " ", text).strip())


def sha256_hex(data):
    if isinstance(data, str):
        data = data.encode("utf8")
    return hashlib.sha256(data).hexdigest()


def canon(obj):
    """해시용 정규 JSON(키 정렬, 공백 없음, 한글 그대로)."""
    return json.dumps(obj, ensure_ascii=False, sort_keys=True, separators=(",", ":"))


def load_adapter(path):
    return json.load(open(path, encoding="utf8"))


def parse_book(html_path):
    return BeautifulSoup(open(html_path, encoding="utf8").read(), "html.parser")


def scene_units(soup, scene):
    """표시 본문 단위 목록: [제목, 문단...]. 선택자는 브라우저 querySelector와 같다."""
    el = soup.select_one(scene["selector"])
    if el is None:
        raise SystemExit(f"장면 선택자를 찾지 못함: {scene['selector']}")
    units = []
    if scene.get("heading"):
        h = el.select_one(scene["heading"])
        if h is None:
            raise SystemExit(f"제목 선택자를 찾지 못함: {scene['selector']} {scene['heading']}")
        units.append(norm(h.get_text()))
    for sel in scene.get("paragraphs", []):
        for p in el.select(sel):
            units.append(norm(p.get_text()))
    return [u for u in units if u]


def apply_pron(text, pron):
    """낭독용 텍스트: 발음 치환만 적용한다(표시 본문은 바꾸지 않는다)."""
    for src, dst in pron:
        text = text.replace(src, dst)
    return text


def text_hash(units):
    return sha256_hex("\n".join(units))
