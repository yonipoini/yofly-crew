from PIL import Image, ImageFilter, ImageDraw

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# 1. Scale the image by 1.30x (so wings fit perfectly, not cut off)
scale = 1.30
new_size = int(1024 * scale) # 1331
scaled = img.resize((new_size, new_size), Image.Resampling.LANCZOS)

# 2. Crop the 1024x1024 center
left = (new_size - 1024) / 2
top = (new_size - 1024) / 2
cropped = scaled.crop((left, top, left + 1024, top + 1024))

# 3. Aggressively remove all white borders (squircle edges)
bg_color = (22, 18, 30, 255)
clean = cropped.copy()
pixels = clean.load()

for y in range(1024):
    for x in range(1024):
        r, g, b, a = pixels[x, y]
        dist_sq = (x - 512)**2 + (y - 512)**2
        # The squircle is 893px wide, radius is ~446. 
        # We start cleaning at radius 420.
        if dist_sq > 420**2:
            if r > 35 or g > 35 or b > 35:
                pixels[x, y] = bg_color

# 4. Blur the cleaned image to create a perfectly seamless background
blurred = clean.filter(ImageFilter.GaussianBlur(30))

# 5. Mask the center to keep it crisp, letting the blurred edges hide any seams
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Mask radius 410 (safely inside the 420 cleaning radius)
draw.ellipse((102, 102, 922, 922), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(20))

final = Image.composite(clean, blurred, mask)

final.save('assets/app-icon-square-v19.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v19 using v10 logic but with 1.30x scale to preserve wings!")
