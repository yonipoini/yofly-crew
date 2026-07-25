from PIL import Image

img = Image.open('assets/logo_cropped.png').convert('RGBA')

# 1. Erase the text by mirroring the top background
top_bg = img.crop((0, 0, 1024, 170))
top_bg_flipped = top_bg.transpose(Image.FLIP_TOP_BOTTOM)
img.paste(top_bg_flipped, (0, 598))

bottom_row = top_bg_flipped.crop((0, 169, 1024, 170))
for y in range(768, 1024):
    img.paste(bottom_row, (0, y))

img.save('assets/app-icon-square-v24.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully generated v24!")
