from PIL import Image, ImageDraw, ImageFilter

base_img = Image.open('assets/app-icon-square-v24.png').convert('RGBA')
glow_source = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# 1. Crop out the white corners, leaving the 600x600 center (logo + wings + glow)
glow_crop = glow_source.crop((212, 212, 812, 812))

# 2. Draw a black box over the logo and wings so they don't get duplicated!
# In the 600x600 crop, the wings span the full width roughly, at y=300
draw = ImageDraw.Draw(glow_crop)
# Box covering wings: they span roughly from x=0 to 600, y=200 to 450 in this crop.
draw.rectangle((0, 150, 600, 450), fill=(0, 0, 0, 255))
# Let's also black out the very top and bottom edges just to be safe
draw.rectangle((0, 0, 600, 50), fill=(0, 0, 0, 255))
draw.rectangle((0, 550, 600, 600), fill=(0, 0, 0, 255))

# 3. Blur heavily to create a smooth, organic, pure aura from what's left
pure_glow = glow_crop.filter(ImageFilter.GaussianBlur(100))

# 4. Resize back to 1024x1024
glow_resized = pure_glow.resize((1024, 1024), Image.Resampling.LANCZOS)

# 5. Screen blend
def screen_blend(img1, img2):
    pixels1 = img1.load()
    pixels2 = img2.load()
    for y in range(1024):
        for x in range(1024):
            r1, g1, b1, a1 = pixels1[x, y]
            r2, g2, b2, a2 = pixels2[x, y]
            
            # The glow extracted might be faint after blurring, let's boost it slightly
            intensity = 1.3
            r2 = min(255, int(r2 * intensity))
            g2 = min(255, int(g2 * intensity))
            b2 = min(255, int(b2 * intensity))
            
            r = int(255 - (255 - r1) * (255 - r2) / 255)
            g = int(255 - (255 - g1) * (255 - g2) / 255)
            b = int(255 - (255 - b1) * (255 - b2) / 255)
            
            pixels1[x, y] = (r, g, b, 255)

screen_blend(base_img, glow_resized)

base_img.save('assets/app-icon-square-v26.png')
base_img.save('assets/app-icon-square.png')
base_img.save('assets/icon.png')
base_img.save('assets/splash-icon.png')
print("Successfully generated v26 by extracting and isolating the authentic original glow!")
