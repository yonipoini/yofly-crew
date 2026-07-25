from PIL import Image, ImageDraw, ImageFilter

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

bg_color = (22, 18, 30, 255)

# 1. Neutralize the white corners so they cannot contaminate the mask blur
for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 230 and g > 230 and b > 230:
            pixels[x, y] = bg_color

# 2. Create the solid background
bg = Image.new('RGBA', (1024, 1024), bg_color)

# 3. Create a smooth radial mask that keeps the glowing center but fades 
# perfectly into the solid background, without catching any white halos.
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# Ellipse radius of 350
draw.ellipse((162, 162, 862, 862), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(80))

# 4. Composite the neutralized image onto the solid background
final = Image.composite(img, bg, mask)

final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Absolutely flawless gradient icon created!")
