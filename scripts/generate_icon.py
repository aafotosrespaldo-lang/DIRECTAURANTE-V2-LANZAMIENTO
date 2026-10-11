import zlib
import struct
import math

def generate_directaurante_icon(output_path, size=512):
    # We will render at supersampled resolution (e.g. scale 2 = 1024x1024) and downsample
    scale = 2
    W = size * scale
    H = size * scale

    # Create pixel buffer (RGBA)
    # Using bytearray of size W * H * 4
    pixels = bytearray(W * H * 4)

    # Geometry parameters (scaled to 100x100 reference coordinate system)
    # Target coordinate space: (0, 0) to (100, 100)
    # Inner box margin: x: 10..90, y: 10..90
    
    # Precompute distance fields and colors for each pixel
    cx = W / 2.0
    cy = H / 2.0
    s100 = W / 100.0

    # Colors (RGBA in 0..1)
    GOLD_BORDER = (1.0, 0.82, 0.0, 1.0) # #FFD100
    GOLD_D = (1.0, 0.82, 0.0, 1.0)      # #FFD100
    WHITE = (1.0, 1.0, 1.0, 1.0)
    PIN_COLOR = (0.12, 0.28, 0.92, 0.5)

    def dist_rounded_rect(px, py, rx_box, ry_box, rw, rh, radius):
        # Center of box
        bx = rx_box + rw / 2.0
        by = ry_box + rh / 2.0
        # Half dimensions minus radius
        dx = abs(px - bx) - (rw / 2.0 - radius)
        dy = abs(py - by) - (rh / 2.0 - radius)
        
        # Outer distance
        ox = max(dx, 0.0)
        oy = max(dy, 0.0)
        dist = math.sqrt(ox * ox + oy * oy) + min(max(dx, dy), 0.0) - radius
        return dist

    def dist_capsule(px, py, x1, y1, x2, y2, r):
        # Distance from point to segment (x1,y1)-(x2,y2) minus r
        dx = x2 - x1
        dy = y2 - y1
        l2 = dx*dx + dy*dy
        if l2 == 0:
            return math.hypot(px - x1, py - y1) - r
        t = max(0.0, min(1.0, ((px - x1)*dx + (py - y1)*dy) / l2))
        proj_x = x1 + t * dx
        proj_y = y1 + t * dy
        return math.hypot(px - proj_x, py - proj_y) - r

    def dist_arc(px, py, acx, acy, ar, a_start, a_end, thickness):
        # Angle from center
        angle = math.atan2(py - acy, px - acx)
        d_center = math.hypot(px - acx, py - acy)
        # Check angle bounds
        if a_start <= angle <= a_end or (a_start < -math.pi and angle >= a_start + 2*math.pi):
            return abs(d_center - ar) - thickness / 2.0
        # Endpoints
        p1x = acx + ar * math.cos(a_start)
        p1y = acy + ar * math.sin(a_start)
        p2x = acx + ar * math.cos(a_end)
        p2y = acy + ar * math.sin(a_end)
        d1 = math.hypot(px - p1x, py - p1y)
        d2 = math.hypot(px - p2x, py - p2y)
        return min(d1, d2) - thickness / 2.0

    # Squircle reference: box (10, 10, 80, 80), corner radius 26
    sq_x, sq_y, sq_w, sq_h, sq_r = 10.0, 10.0, 80.0, 80.0, 26.0

    for y in range(H):
        py_100 = (y / H) * 100.0
        row_offset = y * W * 4
        for x in range(W):
            px_100 = (x / W) * 100.0

            # Distance to main squircle
            d_sq = dist_rounded_rect(px_100, py_100, sq_x, sq_y, sq_w, sq_h, sq_r)

            # Drop shadow
            # Shadow offset is dx=0, dy=4, radius=8
            d_shadow = dist_rounded_rect(px_100, py_100 - 3.5, sq_x, sq_y, sq_w, sq_h, sq_r + 2.0)
            shadow_alpha = 0.0
            if d_shadow < 6.0 and d_sq > 0:
                shadow_alpha = max(0.0, (1.0 - (d_shadow + 2.0) / 8.0) * 0.45)

            if d_sq > 1.5 and shadow_alpha <= 0.001:
                # Fully transparent background
                continue

            # Base gradient
            # Vertical gradient: y=10 -> #0C33DB, y=90 -> #001680
            t_grad = max(0.0, min(1.0, (py_100 - 10.0) / 80.0))
            # Smooth cubic easing
            bg_r = 0.06 * (1.0 - t_grad) + 0.00 * t_grad
            bg_g = 0.21 * (1.0 - t_grad) + 0.08 * t_grad
            bg_b = 0.88 * (1.0 - t_grad) + 0.52 * t_grad
            bg_a = 1.0

            # Antialias squircle edge
            if d_sq > 0.0:
                edge_a = max(0.0, min(1.0, 1.0 - d_sq / 1.0))
                bg_a *= edge_a

            # Golden rim: between d_sq -1.8 and d_sq 0.0
            if -2.2 <= d_sq <= 0.2:
                # Rim factor
                rim_t = 1.0 - abs(d_sq + 1.0) / 1.2
                rim_t = max(0.0, min(1.0, rim_t))
                # Top highlights
                gold_light = 1.0 - 0.25 * t_grad
                bg_r = bg_r * (1.0 - rim_t) + (1.0 * gold_light) * rim_t
                bg_g = bg_g * (1.0 - rim_t) + (0.82 * gold_light) * rim_t
                bg_b = bg_b * (1.0 - rim_t) + (0.02) * rim_t

            # Location Pin Watermark (behind D)
            # Center at (50, 42)
            dx_pin = px_100 - 50.0
            dy_pin = py_100 - 40.0
            r_pin = math.hypot(dx_pin, dy_pin)
            # Outline ring at r=23
            if 20.0 <= r_pin <= 23.5 and py_100 <= 55:
                pin_alpha = 0.28
                bg_r = bg_r * (1.0 - pin_alpha) + 0.15 * pin_alpha
                bg_g = bg_g * (1.0 - pin_alpha) + 0.35 * pin_alpha
                bg_b = bg_b * (1.0 - pin_alpha) + 0.98 * pin_alpha

            # Handle Loop on top of D: center (50, 27), r=4.2, thickness=3.8, angle from -pi to 0
            d_loop = dist_arc(px_100, py_100, 50.0, 27.5, 4.2, -math.pi, 0.0, 3.8)
            if d_loop <= 0.5:
                loop_a = max(0.0, min(1.0, 1.0 - d_loop / 0.5)) if d_loop > 0 else 1.0
                bg_r = bg_r * (1.0 - loop_a) + 1.0 * loop_a
                bg_g = bg_g * (1.0 - loop_a) + 0.82 * loop_a
                bg_b = bg_b * (1.0 - loop_a) + 0.02 * loop_a

            # Golden "D" Monogram
            # Outer D: left spine from (34, 28) to (34, 72)
            # right arc center (51, 50), r=22, angle from -pi/2 to pi/2
            # top bar (34, 28) to (51, 28)
            # bottom bar (34, 72) to (51, 72)
            # Stroke thickness = 8.2
            th_d = 8.2
            d_spine = dist_capsule(px_100, py_100, 34.0, 31.0, 34.0, 69.0, th_d / 2.0)
            d_top_bar = dist_capsule(px_100, py_100, 34.0, 28.5, 51.0, 28.5, th_d / 2.0)
            d_bot_bar = dist_capsule(px_100, py_100, 34.0, 71.5, 51.0, 71.5, th_d / 2.0)
            d_arc = dist_arc(px_100, py_100, 51.0, 50.0, 21.5, -math.pi/2.0, math.pi/2.0, th_d)
            
            d_letter = min(d_spine, d_top_bar, d_bot_bar, d_arc)
            if d_letter <= 0.5:
                let_a = max(0.0, min(1.0, 1.0 - d_letter / 0.5)) if d_letter > 0 else 1.0
                # Gold gradient with subtle highlight
                gold_val = 1.0 - 0.15 * max(0.0, min(1.0, (py_100 - 28.0) / 44.0))
                bg_r = bg_r * (1.0 - let_a) + (1.0 * gold_val) * let_a
                bg_g = bg_g * (1.0 - let_a) + (0.83 * gold_val) * let_a
                bg_b = bg_b * (1.0 - let_a) + 0.02 * let_a

            # Center White Chevron (">")
            # Segment 1: (44, 42) -> (53.5, 50)
            # Segment 2: (53.5, 50) -> (44, 58)
            th_chev = 4.4
            d_ch1 = dist_capsule(px_100, py_100, 44.0, 42.0, 53.5, 50.0, th_chev / 2.0)
            d_ch2 = dist_capsule(px_100, py_100, 53.5, 50.0, 44.0, 58.0, th_chev / 2.0)
            d_chev = min(d_ch1, d_ch2)
            if d_chev <= 0.5:
                chev_a = max(0.0, min(1.0, 1.0 - d_chev / 0.5)) if d_chev > 0 else 1.0
                bg_r = bg_r * (1.0 - chev_a) + 1.0 * chev_a
                bg_g = bg_g * (1.0 - chev_a) + 1.0 * chev_a
                bg_b = bg_b * (1.0 - chev_a) + 1.0 * chev_a

            # Blend with shadow if outside squircle
            if d_sq > 0.0 and shadow_alpha > 0.0:
                bg_r = 0.01
                bg_g = 0.07
                bg_b = 0.35
                bg_a = shadow_alpha

            # Store RGBA
            idx = row_offset + x * 4
            pixels[idx] = int(min(255, max(0, bg_r * 255.0)))
            pixels[idx + 1] = int(min(255, max(0, bg_g * 255.0)))
            pixels[idx + 2] = int(min(255, max(0, bg_b * 255.0)))
            pixels[idx + 3] = int(min(255, max(0, bg_a * 255.0)))

    # Downsample by scale (2x box filter) to get super-crisp antialiasing
    final_w = size
    final_h = size
    final_pixels = bytearray(final_w * final_h * 4)

    for fy in range(final_h):
        for fx in range(final_w):
            r_acc, g_acc, b_acc, a_acc = 0, 0, 0, 0
            for sy in range(scale):
                for sx in range(scale):
                    src_idx = ((fy * scale + sy) * W + (fx * scale + sx)) * 4
                    r_acc += pixels[src_idx]
                    g_acc += pixels[src_idx + 1]
                    b_acc += pixels[src_idx + 2]
                    a_acc += pixels[src_idx + 3]
            
            samples = scale * scale
            dst_idx = (fy * final_w + fx) * 4
            final_pixels[dst_idx] = r_acc // samples
            final_pixels[dst_idx + 1] = g_acc // samples
            final_pixels[dst_idx + 2] = b_acc // samples
            final_pixels[dst_idx + 3] = a_acc // samples

    # Write PNG
    def chunk(tag, data):
        return struct.pack('>I', len(data)) + tag + data + struct.pack('>I', zlib.crc32(tag + data) & 0xffffffff)

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', final_w, final_h, 8, 6, 0, 0, 0))
    raw = bytearray()
    for y in range(final_h):
        raw.append(0)
        raw.extend(final_pixels[y * final_w * 4:(y + 1) * final_w * 4])
    idat = chunk(b'IDAT', zlib.compress(bytes(raw), 9))
    iend = chunk(b'IEND', b'')

    with open(output_path, 'wb') as f:
        f.write(header + ihdr + idat + iend)
    print(f'Generated {output_path} ({final_w}x{final_h}) successfully.')

if __name__ == '__main__':
    generate_directaurante_icon('public/DIRECTAURANTE ICONO.PNG', size=256)
    # Also write lowercase and hyphenated copies for maximum compatibility
    import shutil
    shutil.copyfile('public/DIRECTAURANTE ICONO.PNG', 'public/directaurante-icono.png')
    shutil.copyfile('public/DIRECTAURANTE ICONO.PNG', 'public/logo.png')
