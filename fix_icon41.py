from PIL import Image, ImageDraw, ImageFilter

# Base image is the flawless v24 (full wings, no text, pristine background)
base_img = Image.open('assets/app-icon-square-v24.png').convert('RGBA')

# Create a blank black image for the glow
glow_layer = Image.new('RGBA', (1024, 1024), (0, 0, 0, 255))
draw = ImageDraw.Draw(glow_layer)

# The user wants an intense "bluish gaussian blur" glow.
# We will draw a few layered ellipses to create a complex glow, then blur them massively.
# 1. Outer deep purple glow
draw.ellipse((100, 100, 924, 924), fill=(80, 20, 180, 255))
# 2. Mid bright bluish-purple glow
draw.ellipse((250, 250, 774, 774), fill=(60, 100, 255, 255))
# 3. Inner intense cyan glow
draw.ellipse((350, 350, 674, 674), fill=(0, 255, 255, 255))

# Massive blur to make it a smooth aura
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(120))

# Screen blend the artificial glow onto the base image!
def screen_blend(img1, img2):
    pixels1 = img1.load()
    pixels2 = img2.load()
    for y in range(1024):
        for x in range(1024):
            r1, g1, b1, a1 = pixels1[x, y]
            r2, g2, b2, a2 = pixels2[x, y]
            
            # Screen formula: 1 - (1 - a) * (1 - b)
            # To not make it TOO overwhelming, we can scale the glow intensity down a bit.
            intensity = 0.85
            r2 = int(r2 * intensity)
            g2 = int(g2 * intensity)
            b2 = int(b2 * intensity)
            
            r = int(255 - (255 - r1) * (255 - r2) / 255)
            g = int(255 - (255 - g1) * (255 - g2) / 255)
            b = int(255 - (255 - b1) * (255 - b2) / 255)
            
            pixels1[x, y] = (r, g, b, 255)

screen_blend(base_img, glow_layer)

base_img.save('assets/app-icon-square-v25.png')
base_img.save('assets/app-icon-square.png')
base_img.save('assets/icon.png')
base_img.save('assets/splash-icon.png')
print("Successfully generated v25 with artificial intense glow!")
