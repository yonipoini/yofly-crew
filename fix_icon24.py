from PIL import Image, ImageFilter, ImageDraw

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# 1. Create a clean image where all white corners and anti-aliased lines are forced to bg_color
img_clean = img.copy()
clean_pixels = img_clean.load()

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # The squircle anti-aliased edge and white corners start around radius 335.
        # We aggressively overwrite anything brighter than the dark background outside radius 300.
        dist_sq = (x - 512)**2 + (y - 512)**2
        if dist_sq > 300**2:
            if r > 40 or g > 40 or b > 40:
                clean_pixels[x, y] = bg_color
            
        # Also clean up the bottom artifact line
        if y > 830 and (r > 40 or g > 40 or b > 40):
            clean_pixels[x, y] = bg_color

# 2. Blur the clean image aggressively. This creates a perfectly smooth, mathematically 
# continuous background gradient from the inner purple glow to the dark purple corners.
blurred_bg = img_clean.filter(ImageFilter.GaussianBlur(40))

# 3. Create a mask that keeps the exact original center (logo and wings) 100% sharp,
# but softly fades out BEFORE it hits the original squircle boundary (radius ~340).
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# A circle of radius 280 fits all the wings perfectly.
# 512 - 280 = 232.
draw.ellipse((232, 232, 792, 792), fill=255)
# Soften the mask with a 30px blur so the transition is invisible.
mask = mask.filter(ImageFilter.GaussianBlur(30))

# 4. Composite the crisp original logo onto the flawless blurred background
final = Image.composite(img, blurred_bg, mask)

final.save('assets/app-icon-square-v13.png')
final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Successfully generated v13 icon with full wings and perfect corners!")
