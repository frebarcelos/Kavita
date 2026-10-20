"""Fork (item 7.1): a small synthetic library for the reader end-to-end test, with no real content.

    python make_fixtures.py <library folder>

Creates, under the folder:
  Livro PDF/Livro PDF - 01.pdf   8 portrait pages, each with its number
  Revista/Revista - 01.cbz       8 portrait pages, page 4 (index 3) wide (a spread in one file)
Only the standard library is used.
"""
import struct
import sys
import zipfile
import zlib
from pathlib import Path

PAGES = 8


def pdf(path: Path, pages: int) -> None:
    objects = []

    def add(body: bytes) -> int:
        objects.append(body)
        return len(objects)

    font = add(b"<< /Type /Font /Subtype /Type1 /BaseFont /Helvetica >>")
    page_ids = []
    pages_id = len(objects) + 1 + 2 * pages  # reserved after the pages
    for n in range(1, pages + 1):
        text = f"BT /F1 160 Tf 200 380 Td (p{n}) Tj ET".encode()
        stream = add(b"<< /Length %d >>\nstream\n" % len(text) + text + b"\nendstream")
        page_ids.append(add(
            b"<< /Type /Page /Parent %d 0 R /MediaBox [0 0 600 900] /Resources << /Font << /F1 %d 0 R >> >> "
            b"/Contents %d 0 R >>" % (pages_id, font, stream)))
    kids = b" ".join(b"%d 0 R" % p for p in page_ids)
    assert add(b"<< /Type /Pages /Kids [%s] /Count %d >>" % (kids, pages)) == pages_id
    catalog = add(b"<< /Type /Catalog /Pages %d 0 R >>" % pages_id)

    out = bytearray(b"%PDF-1.4\n")
    offsets = []
    for i, body in enumerate(objects, start=1):
        offsets.append(len(out))
        out += b"%d 0 obj\n" % i + body + b"\nendobj\n"
    xref = len(out)
    out += b"xref\n0 %d\n0000000000 65535 f \n" % (len(objects) + 1)
    out += b"".join(b"%010d 00000 n \n" % o for o in offsets)
    out += b"trailer\n<< /Size %d /Root %d 0 R >>\nstartxref\n%d\n%%%%EOF\n" % (len(objects) + 1, catalog, xref)
    path.write_bytes(bytes(out))


def png(width: int, height: int, shade: int) -> bytes:
    """A grey page with a darker band whose position tells the page apart"""
    band = (shade * 37) % (height - 40)
    rows = b"".join(
        b"\x00" + bytes([40 if band <= y < band + 40 else 200 + shade % 50]) * width for y in range(height))

    def chunk(kind: bytes, data: bytes) -> bytes:
        return struct.pack(">I", len(data)) + kind + data + struct.pack(">I", zlib.crc32(kind + data) & 0xFFFFFFFF)

    header = struct.pack(">IIBBBBB", width, height, 8, 0, 0, 0, 0)
    return b"\x89PNG\r\n\x1a\n" + chunk(b"IHDR", header) + chunk(b"IDAT", zlib.compress(rows)) + chunk(b"IEND", b"")


def cbz(path: Path, pages: int, wide: int) -> None:
    with zipfile.ZipFile(path, "w", zipfile.ZIP_STORED) as archive:
        for n in range(pages):
            width = 1200 if n == wide else 600
            archive.writestr(f"{n + 1:03d}.png", png(width, 900, n))


def main() -> None:
    root = Path(sys.argv[1])
    (root / "Livro PDF").mkdir(parents=True, exist_ok=True)
    (root / "Revista").mkdir(parents=True, exist_ok=True)
    pdf(root / "Livro PDF" / "Livro PDF - 01.pdf", PAGES)
    cbz(root / "Revista" / "Revista - 01.cbz", PAGES, wide=3)
    print(f"fixtures in {root}")


if __name__ == "__main__":
    main()
