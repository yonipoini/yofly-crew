from PIL import Image, ImageFilter, ImageDraw

bg_img = Image.open('assets/logo.png').convert('RGBA')

left = (1536 - 1024) / 2
bg = bg_img.crop((left, 0, left + 1024, 1024))

bg_pixels = bg.load()
for y in range(650, 1024):
    for x in range(1024):
        bg_pixels[x, y] = bg_pixels[10, 1000]

fg_img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
draw.ellipse((512 - 400, 512 - 400, 512 + 400, 512 + 400), fill=255)
mask = mask.filter(ImageFilter.GaussianBlur(100))

final_img = Image.composite(fg_img, bg, mask)

final_img.save('/Users/yoni/.gemini/antigravity-ide/brain/4de2acdb-2f5c-4f3e-883b-2f1b09a17791/scratch/perfect-icon.png')
print("Perfect icon generated!")
