#!/usr/bin/env python3
# ch100-un7z.py — CH-100, mesure 2 : lecteur 7z minimal, bibliothèque standard seulement, lecture seule.
#
#   python3 -I tools/ch100-un7z.py <archive.7z> <fichier de sortie>
#
# Sert à relire hors dépôt les collections déposées en 7z (un fichier par archive, un seul codeur LZMA ou LZMA2, sans
# chiffrement), quand aucun décompresseur 7z n'est installé. Il écrit le fichier contenu (le zip de l'export) à l'endroit
# donné et affiche sa taille ; le SHA-256 du résultat se compare au champ `sha256_zip` du manifeste de la collection.
# Toute autre forme d'archive (plusieurs fichiers, plusieurs codeurs) est refusée par une assertion.
import sys, struct, lzma, os, zlib
def rd_num(b, p):
    f = b[p]; p += 1; mask = 0x80; v = 0
    for i in range(8):
        if not (f & mask):
            v |= (f & (mask - 1)) << (8 * i); return v, p
        v |= b[p] << (8 * i); p += 1; mask >>= 1
    return v, p
def parse_streams(b, p):
    info = {'packPos': 0, 'packSizes': [], 'coders': [], 'unpackSizes': []}
    assert b[p] == 0x06, hex(b[p]); p += 1
    info['packPos'], p = rd_num(b, p); n, p = rd_num(b, p)
    while b[p] != 0x00:
        t = b[p]; p += 1
        if t == 0x09:
            for _ in range(n): v, p = rd_num(b, p); info['packSizes'].append(v)
        elif t == 0x0A:
            alldef = b[p]; p += 1; assert alldef; p += 4 * n
        else: raise Exception('pack attr %x' % t)
    p += 1
    assert b[p] == 0x07; p += 1
    assert b[p] == 0x0B; p += 1
    nf, p = rd_num(b, p); assert nf == 1, 'dossiers %d' % nf
    ext = b[p]; p += 1; assert ext == 0
    nc, p = rd_num(b, p); assert nc == 1, 'codeurs %d' % nc
    flag = b[p]; p += 1; idsz = flag & 0xF
    cid = bytes(b[p:p + idsz]); p += idsz
    assert not (flag & 0x10)
    props = b''
    if flag & 0x20:
        ps, p = rd_num(b, p); props = bytes(b[p:p + ps]); p += ps
    info['coders'].append((cid, props))
    assert b[p] == 0x0C; p += 1
    v, p = rd_num(b, p); info['unpackSizes'].append(v)
    if b[p] == 0x0A:
        p += 1; alldef = b[p]; p += 1; assert alldef; p += 4
    assert b[p] == 0x00; p += 1
    if b[p] == 0x08:  # substreams : on suppose un seul fichier
        p += 1
        while b[p] != 0x00:
            t = b[p]; p += 1
            if t == 0x0D: raise Exception('plusieurs fichiers')
            elif t == 0x0A: alldef = b[p]; p += 1; p += 4
            else: raise Exception('sub attr %x' % t)
        p += 1
    assert b[p] == 0x00; p += 1
    return info, p
def decode(data, cid, props, usize):
    if cid == b'\x03\x01\x01':
        lc = props[0] % 9; r = props[0] // 9; lp = r % 5; pb = r // 5
        ds = struct.unpack('<I', props[1:5])[0]
        f = [{'id': lzma.FILTER_LZMA1, 'lc': lc, 'lp': lp, 'pb': pb, 'dict_size': ds}]
    elif cid == b'\x21':
        b0 = props[0]; ds = 0xFFFFFFFF if b0 == 40 else (2 | (b0 & 1)) << (b0 // 2 + 11)
        f = [{'id': lzma.FILTER_LZMA2, 'dict_size': ds}]
    elif cid == b'\x00': return data[:usize]
    else: raise Exception('codeur %s' % cid.hex())
    return lzma.LZMADecompressor(lzma.FORMAT_RAW, filters=f).decompress(data, usize)
def extraire(chemin, sortie):
    b = open(chemin, 'rb').read()
    assert b[:6] == b"7z\xbc\xaf\x27\x1c"
    off, size, crc = struct.unpack('<QQI', b[12:32])
    h = b[32 + off:32 + off + size]
    if h[0] == 0x17:
        info, _ = parse_streams(h, 1)
        packed = b[32 + info['packPos']:32 + info['packPos'] + info['packSizes'][0]]
        h = decode(packed, *info['coders'][0], info['unpackSizes'][0])
    assert h[0] == 0x01; p = 1
    assert h[p] == 0x04, hex(h[p]); p += 1
    info, p = parse_streams(h, p)
    packed = b[32 + info['packPos']:32 + info['packPos'] + info['packSizes'][0]]
    out = decode(packed, *info['coders'][0], info['unpackSizes'][0])
    assert len(out) == info['unpackSizes'][0]
    open(sortie, 'wb').write(out)
    return len(out)
if __name__ == '__main__':
    print(extraire(sys.argv[1], sys.argv[2]))
