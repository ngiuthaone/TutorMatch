#!/usr/bin/env python3
"""
Render a layered Tutoria hero animation.

The base sky image is never modified. Motion is composited on top of copied
frames, then encoded as MP4 when OpenCV is installed or as GIF otherwise.
"""

from __future__ import annotations

import argparse
import math
import random
import sys
from pathlib import Path

import numpy as np
from PIL import Image, ImageEnhance, ImageFilter


ROOT = Path(__file__).resolve().parents[1]
DEFAULT_ASSETS = ROOT / "assets"
DEFAULT_OUTPUT = ROOT / "dist" / "tutoria-hero-animation.mp4"


def parse_args() -> argparse.Namespace:
    parser = argparse.ArgumentParser(description="Animate the Tutoria hero artwork.")
    parser.add_argument("--sky", type=Path, default=DEFAULT_ASSETS / "tutoria-hero-sky.png")
    parser.add_argument("--jupiter", type=Path, default=DEFAULT_ASSETS / "tutoria-jupiter-layer.png")
    parser.add_argument("--human", type=Path, default=DEFAULT_ASSETS / "tutoria-human-cutout.png")
    parser.add_argument(
        "--foreground",
        type=Path,
        default=None,
        help="Optional transparent foreground layer. Skipped by default because the bundled sky already includes the hill.",
    )
    parser.add_argument("--output", type=Path, default=DEFAULT_OUTPUT)
    parser.add_argument("--duration", type=float, default=10.0, help="Animation length in seconds.")
    parser.add_argument("--fps", type=int, default=30)
    parser.add_argument("--stars", type=int, default=260)
    parser.add_argument("--gif", action="store_true", help="Force GIF output instead of MP4.")
    return parser.parse_args()


def require_file(path: Path) -> None:
    if not path.exists():
        raise FileNotFoundError(f"Missing asset: {path}")


def load_rgba(path: Path) -> Image.Image:
    require_file(path)
    return Image.open(path).convert("RGBA")


def alpha_paste(canvas: Image.Image, layer: Image.Image, xy: tuple[int, int]) -> None:
    canvas.alpha_composite(layer, dest=xy)


def make_star_field(width: int, height: int, count: int) -> list[dict[str, float]]:
    random.seed(42)
    stars = []
    for _ in range(count):
        stars.append(
            {
                "x": random.uniform(0, width),
                "y": random.uniform(0, height * 0.86),
                "size": random.uniform(0.45, 1.9),
                "speed": random.uniform(1.8, 5.8),
                "phase": random.uniform(0, math.tau),
                "depth": random.uniform(0.25, 1.0),
                "warmth": random.uniform(-0.12, 0.22),
            }
        )
    return stars


def draw_stars(width: int, height: int, stars: list[dict[str, float]], t: float) -> Image.Image:
    layer = Image.new("RGBA", (width, height), (0, 0, 0, 0))
    pixels = layer.load()

    for star in stars:
        twinkle = (math.sin(t * math.tau / star["speed"] + star["phase"]) + 1) / 2
        opacity = int(30 + 135 * twinkle)
        drift_x = math.sin(t * math.tau / 18) * 5 * star["depth"]
        drift_y = math.cos(t * math.tau / 22) * 3 * star["depth"]
        x = int(star["x"] + drift_x)
        y = int(star["y"] + drift_y)
        radius = max(1, int(star["size"]))

        if not (0 <= x < width and 0 <= y < height):
            continue

        red = min(255, int(216 + 34 * star["warmth"]))
        green = min(255, int(220 - 18 * star["warmth"]))
        blue = min(255, int(238 - 30 * star["warmth"]))

        for py in range(y - radius, y + radius + 1):
            for px in range(x - radius, x + radius + 1):
                if 0 <= px < width and 0 <= py < height:
                    dist = math.hypot(px - x, py - y)
                    if dist <= radius:
                        alpha = int(opacity * (1 - dist / (radius + 0.01)))
                        pixels[px, py] = (red, green, blue, max(pixels[px, py][3], alpha))

    return layer.filter(ImageFilter.GaussianBlur(radius=0.15))


def scale_layer(layer: Image.Image, scale: float) -> Image.Image:
    width = max(1, round(layer.width * scale))
    height = max(1, round(layer.height * scale))
    return layer.resize((width, height), Image.Resampling.LANCZOS)


def render_frame(
    sky: Image.Image,
    jupiter: Image.Image,
    human: Image.Image,
    foreground: Image.Image | None,
    stars: list[dict[str, float]],
    frame_index: int,
    fps: int,
    duration: float,
) -> Image.Image:
    width, height = sky.size
    t = frame_index / fps
    loop = t / duration
    frame = sky.copy()

    parallax_x = round(math.sin(loop * math.tau) * 7)
    parallax_y = round(math.cos(loop * math.tau) * 4)
    alpha_paste(frame, draw_stars(width, height, stars, t), (0, 0))

    angle = -14 * loop
    jupiter_spin = jupiter.rotate(angle, resample=Image.Resampling.BICUBIC, expand=False)
    alpha_paste(frame, jupiter_spin, (78 + parallax_x, 105 + parallax_y))

    breath = math.sin(t * math.tau / 3.2)
    human_scale = 0.52 + breath * 0.007
    human_layer = scale_layer(human, human_scale)
    glow = Image.new("RGBA", human_layer.size, (140, 190, 255, 0))
    glow.putalpha(human_layer.getchannel("A").filter(ImageFilter.GaussianBlur(radius=10)))
    glow = ImageEnhance.Brightness(glow).enhance(0.22 + 0.08 * (breath + 1) / 2)

    human_x = 1300 - round((human_layer.width - round(human.width * 0.52)) / 2)
    human_y = 525 - round((human_layer.height - round(human.height * 0.52)))
    alpha_paste(frame, glow, (human_x, human_y))
    alpha_paste(frame, human_layer, (human_x, human_y))

    point = (math.sin(t * math.tau / 4.0) + 1) / 2
    sparkle = Image.new("RGBA", (64, 64), (255, 235, 180, 0))
    sparkle_mask = Image.new("L", (64, 64), 0)
    sp = sparkle_mask.load()
    for i in range(64):
        dist = abs(i - 32)
        alpha = max(0, int((1 - dist / 32) * (70 + 70 * point)))
        sp[i, 32] = alpha
        sp[32, i] = alpha
    sparkle.putalpha(sparkle_mask.filter(ImageFilter.GaussianBlur(radius=1.2)))
    alpha_paste(frame, sparkle, (1320, 470))

    if foreground is not None:
        fg_x = round((width - foreground.width) / 2)
        fg_y = height - foreground.height + 18
        alpha_paste(frame, foreground, (fg_x, fg_y))

    warm = math.sin(t * math.tau / 12) * 0.018
    arr = np.asarray(frame).astype(np.float32)
    arr[:, :, 0] *= 1.0 + warm
    arr[:, :, 2] *= 1.0 - warm * 0.55
    return Image.fromarray(np.clip(arr, 0, 255).astype(np.uint8)).convert("RGB")


def save_gif(frames: list[Image.Image], output: Path, fps: int) -> None:
    gif_output = output.with_suffix(".gif")
    frames[0].save(
        gif_output,
        save_all=True,
        append_images=frames[1:],
        duration=round(1000 / fps),
        loop=0,
        optimize=True,
    )
    print(f"Saved GIF: {gif_output}")


def save_mp4(frames: list[Image.Image], output: Path, fps: int) -> bool:
    try:
        import cv2  # type: ignore
    except ImportError:
        return False

    output.parent.mkdir(parents=True, exist_ok=True)
    width, height = frames[0].size
    writer = cv2.VideoWriter(
        str(output),
        cv2.VideoWriter_fourcc(*"mp4v"),
        fps,
        (width, height),
    )
    if not writer.isOpened():
        return False

    for frame in frames:
        rgb = np.asarray(frame)
        writer.write(cv2.cvtColor(rgb, cv2.COLOR_RGB2BGR))
    writer.release()
    print(f"Saved MP4: {output}")
    return True


def main() -> int:
    args = parse_args()
    if args.fps <= 0 or args.duration <= 0:
        raise ValueError("--fps and --duration must be positive")

    sky = load_rgba(args.sky)
    jupiter = load_rgba(args.jupiter)
    human = load_rgba(args.human)
    foreground = load_rgba(args.foreground) if args.foreground else None
    stars = make_star_field(sky.width, sky.height, args.stars)
    total_frames = round(args.duration * args.fps)
    args.output.parent.mkdir(parents=True, exist_ok=True)

    print(f"Rendering {total_frames} frames at {sky.width}x{sky.height}...")
    frames = []
    for index in range(total_frames):
        frames.append(render_frame(sky, jupiter, human, foreground, stars, index, args.fps, args.duration))
        if index % max(1, args.fps) == 0:
            print(f"Frame {index + 1}/{total_frames}")

    if args.gif:
        save_gif(frames, args.output, args.fps)
        return 0

    if not save_mp4(frames, args.output, args.fps):
        print("OpenCV is not installed or MP4 encoding failed; writing GIF fallback.", file=sys.stderr)
        print("For MP4: python3 -m pip install opencv-python pillow numpy", file=sys.stderr)
        save_gif(frames, args.output, args.fps)

    return 0


if __name__ == "__main__":
    raise SystemExit(main())
