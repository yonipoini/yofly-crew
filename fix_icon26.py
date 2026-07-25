from PIL import Image
import math

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# Fix the baked-in artifact line at the bottom
for y in range(820, 1024):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 40 or g > 40 or b > 40:
            if r < 230 and g < 230 and b < 230:
                # Replace with the dark background color roughly at that spot
                pixels[x, y] = (22, 18, 30, 255)

# First, create a map of the "safe" pixels (inside the squircle)
safe_pixels = {}
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Ignore white/anti-aliased corners and the fixed artifact area
        dist_sq = (x - 512)**2 + (y - 512)**2
        if dist_sq < 330**2: 
            safe_pixels[(x, y)] = (r, g, b, a)
        elif r < 60 and g < 60 and b < 60: # If it's a genuine dark background pixel
             safe_pixels[(x, y)] = (r, g, b, a)

print("Finding nearest colors for corners...")
for y in range(height):
    for x in range(width):
        if (x, y) not in safe_pixels:
            # Find the nearest safe pixel
            # To optimize, we know safe pixels form a squircle around the center.
            # We can draw a line from (x, y) to the center (512, 512) and find 
            # the first pixel along that line that is safe!
            
            # Vector to center
            dx = 512 - x
            dy = 512 - y
            dist = math.hypot(dx, dy)
            
            # Step towards center until we hit a safe pixel
            found = False
            for step in range(int(dist)):
                ratio = step / dist
                check_x = int(x + dx * ratio)
                check_y = int(y + dy * ratio)
                if (check_x, check_y) in safe_pixels:
                    pixels[x, y] = safe_pixels[(check_x, check_y)]
                    found = True
                    break
            
            if not found:
                # Fallback to dark background
                pixels[x, y] = (22, 18, 30, 255)

img.save('assets/app-icon-square-v14.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully generated v14 by stretching the boundary colors!")
