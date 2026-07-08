"""stt.py — telinga lokal Nata IDE (faster-whisper, bahasa Indonesia).
Dipanggil main process: venv/bin/python tools/stt.py --audio /path/rekaman.webm
Output: baris terakhir stdout = teks transkrip (atau kosong).
Model 'base' (~145MB) auto-download sekali ke ~/.cache/huggingface.
"""
import argparse
import sys

def main():
    ap = argparse.ArgumentParser()
    ap.add_argument('--audio', required=True)
    ap.add_argument('--model', default='base')
    ap.add_argument('--lang', default='id')
    args = ap.parse_args()

    from faster_whisper import WhisperModel
    print('STATUS:loading', flush=True)
    # int8 = paling hemat RAM & cepat di CPU Apple Silicon
    model = WhisperModel(args.model, device='cpu', compute_type='int8')
    print('STATUS:transcribing', flush=True)
    segments, _info = model.transcribe(args.audio, language=args.lang, beam_size=1, vad_filter=True)
    text = ' '.join(s.text.strip() for s in segments).strip()
    print('TEXT:' + text, flush=True)

if __name__ == '__main__':
    try:
        main()
    except Exception as e:
        print('ERROR:' + str(e), file=sys.stderr, flush=True)
        sys.exit(1)
