from PIL import Image, ImageDraw, ImageFilter
import shutil

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# Fix the baked-in gray dashed line at y=852
for y in range(820, 1024):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 40 or g > 40 or b > 40:
            if r < 230 and g < 230 and b < 230:
                pixels[x, y] = bg_color

# We won't even neutralize the corners, because our mask will be so tight
# that it completely ignores the entire outer edge of the squircle, 
# ensuring NO border lines whatsoever are visible.

bg = Image.new('RGBA', (1024, 1024), bg_color)

mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# The squircle is at 168 to 855. We will make the mask much tighter: 220 to 804.
# This cuts off the entire edge and its border line!
draw.ellipse((220, 220, 804, 804), fill=255)
# Super heavy blur so it fades flawlessly
mask = mask.filter(ImageFilter.GaussianBlur(120))

final = Image.composite(img, bg, mask)

# Save to a new cache-busting file
final.save('assets/app-icon-square-v6.png')

final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v6 icon without any borders!")
