from PIL import Image
import math

img = Image.open('assets/app-icon-square.png').convert('RGBA')
width, height = img.size
pixels = img.load()

cx, cy = width / 2, height / 2

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 230 and g > 230 and b > 230:
            dx = cx - x
            dy = cy - y
            dist = math.hypot(dx, dy)
            if dist == 0: continue
            
            step_x = dx / dist
            step_y = dy / dist
            
            curr_x = float(x)
            curr_y = float(y)
            found = False
            for i in range(int(dist)):
                curr_x += step_x
                curr_y += step_y
                px = int(round(curr_x))
                py = int(round(curr_y))
                if px < 0 or px >= width or py < 0 or py >= height: continue
                pr, pg, pb, pa = pixels[px, py]
                if not (pr > 230 and pg > 230 and pb > 230):
                    pixels[x, y] = (pr, pg, pb, pa)
                    found = True
                    break
            if not found:
                pixels[x, y] = (29, 27, 55, 255)

img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully fixed and replaced all icons!")
