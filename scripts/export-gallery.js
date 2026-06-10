#!/usr/bin/env node
/**
 * 온라인 갤러리(Supabase, is_public=true) 이미지 일괄 추출 스크립트.
 *
 * 전시 출력용으로, 공개된 작품들의 원본 이미지를 한 번에 실제 이미지 파일로
 * 내려받고, 각 파일의 해상도/출력 적합성/중복/플레이스홀더 여부를 리포트한다.
 *
 * 사용법:
 *   node scripts/export-gallery.js [출력폴더]
 *
 * 옵션(환경변수):
 *   EXPORT_BASE_URL   기본: https://mind-canvas-sand.vercel.app
 *   EXPORT_DEDUP=1    동일 (제목+이미지) 중복 항목은 첫 번째만 저장
 *
 * 결과:
 *   <출력폴더>/images/*.jpg|png  — 추출된 원본 이미지
 *   <출력폴더>/manifest.csv      — 제목/날짜/해상도/출력크기 등 메타데이터
 */

const fs = require('fs');
const path = require('path');

const BASE_URL = (process.env.EXPORT_BASE_URL || 'https://mind-canvas-sand.vercel.app').replace(/\/$/, '');
const OUT_DIR = path.resolve(process.argv[2] || 'exhibition-export');
const IMG_DIR = path.join(OUT_DIR, 'images');
const DEDUP = process.env.EXPORT_DEDUP === '1';
const PRINT_DPI = 300; // 미술관급 근접 감상 기준

// data URL → { mime, buffer }
function parseDataUrl(dataUrl) {
  if (!dataUrl || typeof dataUrl !== 'string') return null;
  const m = dataUrl.match(/^data:(.*?);base64,(.*)$/s);
  if (!m) return null;
  return { mime: m[1], buffer: Buffer.from(m[2], 'base64') };
}

// JPEG/PNG 픽셀 크기 파싱
function getDimensions(buf, mime) {
  try {
    if (mime === 'image/png') {
      // PNG: IHDR은 항상 오프셋 16부터 width(4)·height(4) big-endian
      return { w: buf.readUInt32BE(16), h: buf.readUInt32BE(20) };
    }
    // JPEG: SOF0~SOF15 마커에서 height/width
    let i = 2;
    while (i < buf.length) {
      if (buf[i] !== 0xFF) { i++; continue; }
      const marker = buf[i + 1];
      if (marker >= 0xC0 && marker <= 0xCF && marker !== 0xC4 && marker !== 0xC8 && marker !== 0xCC) {
        return { h: buf.readUInt16BE(i + 5), w: buf.readUInt16BE(i + 7) };
      }
      i += 2 + buf.readUInt16BE(i + 2);
    }
  } catch (e) { /* fallthrough */ }
  return { w: 0, h: 0 };
}

function extFor(mime) {
  if (mime === 'image/png') return 'png';
  if (mime === 'image/webp') return 'webp';
  return 'jpg';
}

function safeName(s) {
  return (s || '무제')
    .replace(/[\\/:*?"<>|]/g, '')   // 파일명 금지문자 제거
    .replace(/\s+/g, '_')
    .slice(0, 40);
}

function cm(px, dpi) { return (px / dpi * 2.54).toFixed(1); }

function csvCell(v) {
  const s = String(v == null ? '' : v);
  return /[",\n]/.test(s) ? '"' + s.replace(/"/g, '""') + '"' : s;
}

(async () => {
  console.log(`소스: ${BASE_URL}/api/gallery`);
  const res = await fetch(`${BASE_URL}/api/gallery`);
  if (!res.ok) {
    console.error('갤러리 조회 실패:', res.status, await res.text());
    process.exit(1);
  }
  const { items = [] } = await res.json();
  console.log(`공개 항목 ${items.length}개 발견\n`);

  fs.mkdirSync(IMG_DIR, { recursive: true });

  const seen = new Set();
  const rows = [];
  let saved = 0, skippedDup = 0, placeholders = 0, lowRes = 0, noImage = 0;

  items.forEach((it, idx) => {
    const parsed = parseDataUrl(it.image_url);
    if (!parsed) { noImage++; return; }

    // 중복 판별: 제목 + 이미지 앞부분 해시 대용(길이+선두 64자)
    const dupKey = (it.title || '') + '|' + (it.image_url || '').slice(0, 64) + '|' + (it.image_url || '').length;
    if (DEDUP && seen.has(dupKey)) { skippedDup++; return; }
    seen.add(dupKey);

    const { mime, buffer } = parsed;
    const { w, h } = getDimensions(buffer, mime);
    const ext = extFor(mime);

    // 플레이스홀더 추정: 생성 실패 시 만드는 캔버스는 정확히 600x600 PNG
    const isPlaceholder = mime === 'image/png' && w === h && w <= 600;
    if (isPlaceholder) placeholders++;

    // 저해상도 경고: 긴 변이 1024 미만이면 근접 전시에 부적합
    const longSide = Math.max(w, h);
    if (!isPlaceholder && longSide && longSide < 1024) lowRes++;

    const date = (it.created_at || '').slice(0, 10);
    const n = String(idx + 1).padStart(2, '0');
    const fname = `${n}_${date}_${safeName(it.title)}.${ext}`;
    fs.writeFileSync(path.join(IMG_DIR, fname), buffer);
    saved++;

    rows.push({
      file: fname,
      title: it.title || '무제',
      date,
      emotions: Array.isArray(it.emotions) ? it.emotions.join(' ') : '',
      px: w && h ? `${w}x${h}` : '?',
      kb: (buffer.length / 1024).toFixed(0),
      printCm: w && h ? `${cm(w, PRINT_DPI)}x${cm(h, PRINT_DPI)}` : '?',
      note: isPlaceholder ? '플레이스홀더(제외권장)' : (longSide && longSide < 1024 ? '저해상도' : '')
    });
  });

  // manifest.csv
  const header = ['file', 'title', 'date', 'emotions', 'px', 'kb', `print_cm@${PRINT_DPI}dpi`, 'note'];
  const csv = [header.join(',')]
    .concat(rows.map(r => [r.file, r.title, r.date, r.emotions, r.px, r.kb, r.printCm, r.note].map(csvCell).join(',')))
    .join('\n');
  fs.writeFileSync(path.join(OUT_DIR, 'manifest.csv'), '﻿' + csv); // BOM: Excel 한글 호환

  console.log('── 추출 결과 ──');
  rows.forEach(r => console.log(`  ${r.file}  [${r.px}px, ${r.printCm}cm@${PRINT_DPI}dpi]${r.note ? '  ⚠ ' + r.note : ''}`));
  console.log('');
  console.log(`저장: ${saved}개  →  ${IMG_DIR}`);
  if (skippedDup)  console.log(`중복 제외: ${skippedDup}개`);
  if (placeholders) console.log(`⚠ 플레이스홀더(생성실패 추정): ${placeholders}개 — 출력 대상에서 제외 권장`);
  if (lowRes)       console.log(`⚠ 저해상도(긴 변<1024px): ${lowRes}개`);
  if (noImage)      console.log(`이미지 없음: ${noImage}개`);
  console.log(`메타데이터: ${path.join(OUT_DIR, 'manifest.csv')}`);
})().catch(e => { console.error('오류:', e); process.exit(1); });
