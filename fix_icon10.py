from PIL import Image, ImageDraw, ImageFilter

img = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# The exact dark corner color of the original squircle
bg_color = (22, 18, 30, 255)
bg = Image.new('RGBA', (1024, 1024), bg_color)

# Create a smooth circular mask that keeps the entire center (logo + glow)
# but fades out completely before hitting the white corners
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# The white corners start around x=168. So a circle of radius 300 is perfectly safe.
# Center is 512. 512-300 = 212.
draw.ellipse((162, 162, 862, 862), fill=255)
# Super heavy blur for a completely seamless fade into the dark background
mask = mask.filter(ImageFilter.GaussianBlur(80))

# Paste the original glowing image over the solid dark background using the seamless mask
final = Image.composite(img, bg, mask)

final.save('assets/app-icon-square.png')
final.save('assets/icon.png')
final.save('assets/splash-icon.png')
print("Seamless glowing icon created!")
