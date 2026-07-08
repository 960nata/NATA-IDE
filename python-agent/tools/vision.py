"""vision.py — mata lokal Nata IDE (opencv, tanpa model berat).
--image foto.jpg          → dimensi, kecerahan, ketajaman(blur), warna dominan, jumlah wajah
--video clip.mp4 --frames 6 --outdir Frames → ekstrak N frame merata ke folder
Output: baris RESULT:{json}
"""
import argparse
import json
import os
import sys


def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--image')
    ap.add_argument('--video')
    ap.add_argument('--frames', type=int, default=6)
    ap.add_argument('--outdir', default='Frames')
    a = ap.parse_args()
    import cv2
    import numpy as np

    if a.image:
        img = cv2.imread(a.image)
        if img is None:
            print('ERROR:gagal baca gambar', file=sys.stderr)
            sys.exit(1)
        h, w = img.shape[:2]
        gray = cv2.cvtColor(img, cv2.COLOR_BGR2GRAY)
        # warna dominan via kmeans di thumbnail 64x64 (cepat)
        Z = np.float32(cv2.resize(img, (64, 64)).reshape(-1, 3))
        crit = (cv2.TERM_CRITERIA_EPS + cv2.TERM_CRITERIA_MAX_ITER, 10, 1.0)
        _c, labels, centers = cv2.kmeans(Z, 4, None, crit, 3, cv2.KMEANS_PP_CENTERS)
        order = np.argsort(-np.bincount(labels.flatten()))
        cols = ['#%02x%02x%02x' % (int(c[2]), int(c[1]), int(c[0])) for c in centers[order]]
        faces = 0
        try:
            casc = cv2.CascadeClassifier(cv2.data.haarcascades + 'haarcascade_frontalface_default.xml')
            faces = len(casc.detectMultiScale(gray, 1.1, 5))
        except Exception:
            pass
        print('RESULT:' + json.dumps({
            'lebar': w, 'tinggi': h,
            'kecerahan': round(float(np.mean(gray)), 1),
            'ketajaman': round(float(cv2.Laplacian(gray, cv2.CV_64F).var()), 1),
            'warna_dominan': cols,
            'wajah_terdeteksi': faces,
        }), flush=True)
    elif a.video:
        cap = cv2.VideoCapture(a.video)
        if not cap.isOpened():
            print('ERROR:gagal buka video', file=sys.stderr)
            sys.exit(1)
        n = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        fps = cap.get(cv2.CAP_PROP_FPS) or 25
        os.makedirs(a.outdir, exist_ok=True)
        saved = []
        for i in range(max(1, a.frames)):
            cap.set(cv2.CAP_PROP_POS_FRAMES, int(n * (i + 0.5) / max(1, a.frames)))
            ok, fr = cap.read()
            if ok:
                p = os.path.join(a.outdir, 'frame_%02d.png' % (i + 1))
                cv2.imwrite(p, fr)
                saved.append(p)
        cap.release()
        print('RESULT:' + json.dumps({
            'total_frame': n, 'fps': round(fps, 1),
            'durasi_detik': round(n / fps, 1) if fps else 0,
            'frame_tersimpan': saved,
        }), flush=True)
    else:
        print('ERROR:butuh --image atau --video', file=sys.stderr)
        sys.exit(1)


if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERROR:' + str(e), file=sys.stderr)
        sys.exit(1)
