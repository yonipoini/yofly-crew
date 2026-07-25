from PIL import Image, ImageFilter, ImageDraw

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# 1. Create a clean image with no white corners or artifacts
img_clean = img.copy()
clean_pixels = img_clean.load()

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Aggressively remove anything brighter than the dark purple background
        # that is outside the immediate center, so it doesn't contaminate the blur.
        if (x - 512)**2 + (y - 512)**2 > 300**2:
            if r > 40 or g > 40 or b > 40:
                clean_pixels[x, y] = bg_color
        
        # Bottom line artifact
        if y > 820 and (r > 40 or g > 40 or b > 40):
            clean_pixels[x, y] = bg_color

# 2. Blur the clean image aggressively for a perfectly flawless background
blurred_bg = img_clean.filter(ImageFilter.GaussianBlur(60))

# 3. Create an elliptical mask perfectly shaped to enclose the full wings!
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Wide enough for the wings (175 to 849), short enough to avoid squircle edges (250 to 774)
draw.ellipse((175, 250, 849, 774), fill=255)
# Soften the mask 
mask = mask.filter(ImageFilter.GaussianBlur(30))

# 4. Composite the crisp logo onto the flawless blurred background
final = Image.composite(img, blurred_bg, mask)

# Cache bust!
final.save('assets/app-icon-square-v15.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v15 with perfect wings and flawless background!")
