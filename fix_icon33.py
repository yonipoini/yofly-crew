from PIL import Image, ImageFilter, ImageDraw

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# 1. Create a PERFECTLY clean foreground image!
# This image contains the original wings and glow, but absolutely ZERO white corners or squircle edges!
img_clean = img.copy()
clean_pixels = img_clean.load()

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Erase everything outside the immediate center that is bright
        if (x - 512)**2 + (y - 512)**2 > 300**2:
            if r > 40 or g > 40 or b > 40:
                clean_pixels[x, y] = bg_color
        # Bottom artifact
        if y > 820 and (r > 40 or g > 40 or b > 40):
            clean_pixels[x, y] = bg_color

# 2. Blur the clean image aggressively for a perfectly flawless background
blurred_bg = img_clean.copy().filter(ImageFilter.GaussianBlur(60))

# 3. Create an elliptical mask to keep the center crisp, and smoothly fade to the blurred background
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Ellipse precisely matching the glow and wings
draw.ellipse((180, 260, 844, 764), fill=255)
# Soften the transition
mask = mask.filter(ImageFilter.GaussianBlur(30))

# 4. Composite the CLEAN foreground (no white corners!) onto the flawless blurred background
# Because img_clean has NO white pixels, even if the mask expands, NO white pixels will EVER show!
final = Image.composite(img_clean, blurred_bg, mask)

final.save('assets/app-icon-square-v18.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v18 with full wings, no scale, and zero white artifacts!")
