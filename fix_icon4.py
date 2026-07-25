from PIL import Image, ImageFilter

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')
width, height = img.size
pixels = img.load()

mask = Image.new('L', (width, height), 0)
mask_pixels = mask.load()

for y in range(height):
    for x in range(width):
        r, g, b, a = pixels[x, y]
        if r > 240 and g > 240 and b > 240:
            mask_pixels[x, y] = 0
            pixels[x, y] = (0, 0, 0, 0)
        else:
            mask_pixels[x, y] = 255

mask = mask.filter(ImageFilter.GaussianBlur(1))

bg = img.resize((1500, 1500), Image.Resampling.LANCZOS)
left = (1500 - 1024) / 2
bg = bg.crop((left, left, left + 1024, left + 1024))
bg = bg.filter(ImageFilter.GaussianBlur(50))

bg.paste(img, (0, 0), mask)
bg.save('/Users/yoni/.gemini/antigravity-ide/brain/4de2acdb-2f5c-4f3e-883b-2f1b09a17791/scratch/test-bg.png')
print("Test background created")
