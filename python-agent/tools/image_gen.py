#!/usr/bin/env python3
"""image_gen.py — generate gambar lokal pakai Stable Diffusion.

Dipanggil sebagai subprocess oleh agent-tools.js. Progress dicetak ke stdout
biar bisa di-parse Node, error ke stderr.

Apple Silicon (M1/M2/M3): pakai MPS (Metal) → cepet + hemat energi.
Proses mati sendiri setelah selesai → model otomatis keluar dari RAM.
"""

import sys, argparse
from pathlib import Path


def main():
    p = argparse.ArgumentParser()
    p.add_argument("--prompt",   required=True)
    p.add_argument("--output",   required=True)
    p.add_argument("--negative", default="")
    p.add_argument("--steps",    type=int, default=15)   # default hemat
    p.add_argument("--width",    type=int, default=512)
    p.add_argument("--height",   type=int, default=512)
    p.add_argument("--seed",     type=int, default=-1)
    p.add_argument("--model",    default="runwayml/stable-diffusion-v1-5")
    args = p.parse_args()

    # Hard cap: lindungi Mac dari beban ekstrim
    args.steps  = min(args.steps,  30)
    args.width  = min(args.width,  768)
    args.height = min(args.height, 768)

    try:
        import torch
    except ImportError:
        print("ERROR:torch_missing", flush=True)
        sys.exit(1)

    try:
        from diffusers import StableDiffusionPipeline, DPMSolverMultistepScheduler
    except ImportError:
        print("ERROR:diffusers_missing", flush=True)
        sys.exit(1)

    # Pilih device: MPS (Apple Silicon) > CPU (Intel)
    if torch.backends.mps.is_available():
        device = "mps"
        dtype  = torch.float16
    else:
        device = "cpu"
        dtype  = torch.float32   # MPS fp16 required, CPU butuh fp32

    print(f"STATUS:device:{device}", flush=True)
    print(f"STATUS:loading:{args.model}", flush=True)

    pipe = StableDiffusionPipeline.from_pretrained(
        args.model,
        torch_dtype=dtype,
        safety_checker=None,
        requires_safety_checker=False,
    )
    pipe.scheduler = DPMSolverMultistepScheduler.from_config(pipe.scheduler.config)
    pipe = pipe.to(device)
    pipe.enable_attention_slicing()  # hemat memori, wajib buat 8GB

    print("STATUS:generating", flush=True)

    generator = torch.Generator(device=device)
    if args.seed >= 0:
        generator.manual_seed(args.seed)

    # Callback progress: dicetak per step
    def on_step_end(p, step, timestep, callback_kwargs):
        print(f"PROGRESS:{step + 1}/{args.steps}", flush=True)
        return callback_kwargs

    result = pipe(
        prompt=args.prompt,
        negative_prompt=args.negative or None,
        num_inference_steps=args.steps,
        width=args.width,
        height=args.height,
        generator=generator,
        callback_on_step_end=on_step_end,
    )

    out = Path(args.output)
    out.parent.mkdir(parents=True, exist_ok=True)
    result.images[0].save(out)

    print(f"DONE:{out}", flush=True)


if __name__ == "__main__":
    main()
