from PIL import Image, ImageFilter, ImageDraw

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

# Create a clean version of the image for the background
# We aggressively remove the white background and the anti-aliased edges
bg_base = Image.new('RGBA', (width, height), (22, 19, 31, 255))
bg_pixels = bg_base.load()

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        # Only keep the pure inner pixels for the blur to avoid white halos
        if r < 200 and g < 200 and b < 200:
            bg_pixels[x, y] = (r, g, b, a)

# Apply a massive blur to create the perfect purple/black gradient glow
# that extends all the way to the corners seamlessly
blurred_bg = bg_base.filter(ImageFilter.GaussianBlur(100))

# Now we extract just the center logo and its immediate glow from the original image.
# The squircle is about 687x682. The center 600x600 is totally safe from white edges.
mask = Image.new('L', (width, height), 0)
draw = ImageDraw.Draw(mask)
# Draw a soft circle in the middle
draw.ellipse((212, 212, 812, 812), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(50))

# Composite the sharp original center onto our new flawless glowing background
final_img = Image.composite(img, blurred_bg, mask)

final_img.save('assets/app-icon-square.png')
final_img.save('assets/icon.png')
final_img.save('assets/splash-icon.png')
print("Flawless glowing icon created!")
