from PIL import Image, ImageDraw, ImageFilter

base_img = Image.open('assets/app-icon-square-v24.png').convert('RGBA')
glow_layer = Image.new('RGBA', (1024, 1024), (0, 0, 0, 255))
draw = ImageDraw.Draw(glow_layer)

# 1. Wide horizontal glow for the wings
# Deep purple aura
draw.ellipse((50, 350, 974, 650), fill=(80, 20, 180, 255))
# Bright bluish-purple
draw.ellipse((150, 400, 874, 600), fill=(60, 100, 255, 255))

# 2. Taller vertical/circular glow for the center airplane
# Deep purple aura
draw.ellipse((200, 150, 824, 750), fill=(80, 20, 180, 255))
# Bright bluish-purple
draw.ellipse((300, 250, 724, 650), fill=(60, 100, 255, 255))
# Intense cyan center
draw.ellipse((400, 350, 624, 550), fill=(0, 255, 255, 255))

# 3. Blur heavily to create a seamless, perfectly shaped aura
glow_layer = glow_layer.filter(ImageFilter.GaussianBlur(100))

# 4. Screen blend
def screen_blend(img1, img2):
    pixels1 = img1.load()
    pixels2 = img2.load()
    for y in range(1024):
        for x in range(1024):
            r1, g1, b1, a1 = pixels1[x, y]
            r2, g2, b2, a2 = pixels2[x, y]
            
            intensity = 1.0
            r2 = min(255, int(r2 * intensity))
            g2 = min(255, int(g2 * intensity))
            b2 = min(255, int(b2 * intensity))
            
            r = int(255 - (255 - r1) * (255 - r2) / 255)
            g = int(255 - (255 - g1) * (255 - g2) / 255)
            b = int(255 - (255 - b1) * (255 - b2) / 255)
            
            pixels1[x, y] = (r, g, b, 255)

screen_blend(base_img, glow_layer)

base_img.save('assets/app-icon-square-v28.png')
base_img.save('assets/app-icon-square.png')
base_img.save('assets/icon.png')
base_img.save('assets/splash-icon.png')
print("Successfully generated v28 with a perfectly shaped, pure color artificial glow!")
