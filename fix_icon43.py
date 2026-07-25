from PIL import Image, ImageFilter, ImageDraw

base_img = Image.open('assets/app-icon-square-v24.png').convert('RGBA')
glow_source = Image.open('assets/android-icon-foreground.png').convert('RGBA')
glow_pixels = glow_source.load()

# 1. Clean the white corners from the source so they don't bleed into the blur
bg_color = (22, 18, 30, 255)
for y in range(1024):
    for x in range(1024):
        dist_sq = (x - 512)**2 + (y - 512)**2
        if dist_sq > 420**2:
            r, g, b, a = glow_pixels[x, y]
            if r > 35 or g > 35 or b > 35:
                glow_pixels[x, y] = bg_color

# 2. Apply a MASSIVE blur to completely dissolve the airplane and wings into a pure, intense aura
pure_glow = glow_source.filter(ImageFilter.GaussianBlur(80))

# 3. Create a mask so the intense glow is strongest in the center and fades out, 
# preventing the entire image from becoming too bright.
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((100, 100, 924, 924), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(100))

# 4. Screen blend the pure aura onto the base image
def screen_blend(img1, img2, mask_img):
    pixels1 = img1.load()
    pixels2 = img2.load()
    mask_pixels = mask_img.load()
    
    for y in range(1024):
        for x in range(1024):
            r1, g1, b1, a1 = pixels1[x, y]
            r2, g2, b2, a2 = pixels2[x, y]
            
            # Use mask to control intensity
            m = mask_pixels[x, y] / 255.0
            
            # Boost the aura slightly to make it pop
            intensity = 1.4 * m
            r2 = min(255, int(r2 * intensity))
            g2 = min(255, int(g2 * intensity))
            b2 = min(255, int(b2 * intensity))
            
            # Screen formula
            r = int(255 - (255 - r1) * (255 - r2) / 255)
            g = int(255 - (255 - g1) * (255 - g2) / 255)
            b = int(255 - (255 - b1) * (255 - b2) / 255)
            
            pixels1[x, y] = (r, g, b, 255)

screen_blend(base_img, pure_glow, mask)

base_img.save('assets/app-icon-square-v27.png')
base_img.save('assets/app-icon-square.png')
base_img.save('assets/icon.png')
base_img.save('assets/splash-icon.png')
print("Successfully generated v27 with massive, intense, authentic aura!")
