from PIL import Image, ImageFilter, ImageDraw

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# 1. Scale by 1.45x.
# Squircle becomes 996 wide (14px from edge).
# Wings become 942 wide (41px from edge).
scale = 1.45
new_size = int(1024 * scale) # 1484
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)

left = (new_size - 1024) // 2
top = (new_size - 1024) // 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

# 2. Aggressively neutralize the white/grey borders in the extreme edges
bg_color = (22, 18, 30, 255)
clean = cropped.copy()
pixels = clean.load()

for y in range(1024):
    for x in range(1024):
        # The squircle straight edge is 14px from the edge.
        # We only clean pixels that are close to the edge (x < 30 or x > 994 or y < 30 or y > 994)
        # OR in the corners (dist > 450)
        dist_sq = (x - 512)**2 + (y - 512)**2
        
        is_edge = x < 40 or x > 984 or y < 40 or y > 984
        is_corner = dist_sq > 420**2
        
        if is_edge or is_corner:
            r, g, b, a = pixels[x, y]
            if r > 35 or g > 35 or b > 35:
                pixels[x, y] = bg_color

# 3. Blur the cleaned image
blurred = clean.copy().filter(ImageFilter.GaussianBlur(20))

# 4. Create a SQUARE mask to seamlessly blend ONLY the outer 30 pixels!
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Draw a pure white square leaving a 30px margin
draw.rectangle((30, 30, 994, 994), fill=255)
# Soften the mask so it fades smoothly into the blurred edges
mask = mask.filter(ImageFilter.GaussianBlur(15))

# 5. Composite!
final = Image.composite(clean, blurred, mask)

final.save('assets/app-icon-square-v20.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v20 using 1.45x scale and a SQUARE mask!")
