from PIL import Image, ImageDraw, ImageFilter
import shutil

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# Fix the baked-in gray dashed line at y=852 and any other garbage at the bottom!
# We'll just carefully erase any bright pixels below y=820.
for y in range(820, 1024):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 40 or g > 40 or b > 40: # If it's brighter than the dark background
            if r < 230 and g < 230 and b < 230: # Ignore the white mask
                pixels[x, y] = bg_color

# Neutralize the white corners so they cannot contaminate the mask blur
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 230 and g > 230 and b > 230:
            pixels[x, y] = bg_color

# Create the solid background
bg = Image.new('RGBA', (1024, 1024), bg_color)

# Create a smooth radial mask that keeps the glowing center but fades 
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((162, 162, 862, 862), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(80))

# Composite
final = Image.composite(img, bg, mask)

# Save to a completely new file name to bust the image cache!
final.save('assets/app-icon-square-v5.png')

# Also overwrite the actual assets for the build
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated cache-busting final icon!")
