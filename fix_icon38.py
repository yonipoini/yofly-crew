from PIL import Image, ImageChops

img = Image.open('assets/logo_cropped.png').convert('RGBA')

# 1. Erase the text by mirroring the top background
# The top background from y=0 to y=170 perfectly matches the gradient at y=598 down to y=768 when flipped.
top_bg = img.crop((0, 0, 1024, 170))
top_bg_flipped = top_bg.transpose(Image.FLIP_TOP_BOTTOM)
img.paste(top_bg_flipped, (0, 598))

# What about y=768 to 1024? We just stretch the bottom row of our flipped patch!
bottom_row = top_bg_flipped.crop((0, 169, 1024, 170))
for y in range(768, 1024):
    img.paste(bottom_row, (0, y))

# 2. The user wants the intense bluish-purple Gaussian glow from the other image!
# Let's extract the glow from android-icon-foreground.png.
glow_source = Image.open('assets/android-icon-foreground.png').convert('RGBA')

# We only want the glow, so we crop out the white corners. 
# The inner 600x600 of android-icon-foreground.png contains the pure glow.
glow_crop = glow_source.crop((212, 212, 812, 812))
# Resize it to cover a large area in our final image
glow_resized = glow_crop.resize((1024, 1024), Image.Resampling.LANCZOS)

# Create a clean mask to extract ONLY the intense central glow (avoiding edges)
mask = Image.new('L', (1024, 1024), 0)
from PIL import ImageDraw, ImageFilter
draw = ImageDraw.Draw(mask)
draw.ellipse((200, 200, 824, 824), fill=200) # Semi-transparent to not overwhelm
mask = mask.filter(ImageFilter.GaussianBlur(100)) # Huge blur for a seamless glow

# Add the glow using screen mode (or similar). Since PIL doesn't have a built-in screen composite,
# we just alpha composite the blurred glow over the background, but underneath the main logo!
# Wait, we can't composite underneath the logo because the logo is flattened onto the background in logo_cropped.png!

# Simple trick: we can just add the glow using Screen blend mode!
def screen_blend(img1, img2, mask):
    # img1 is base, img2 is glow
    pixels1 = img1.load()
    pixels2 = img2.load()
    mask_pixels = mask.load()
    for y in range(1024):
        for x in range(1024):
            r1, g1, b1, a1 = pixels1[x, y]
            r2, g2, b2, a2 = pixels2[x, y]
            m = mask_pixels[x, y] / 255.0
            
            # Screen formula: 1 - (1 - a) * (1 - b)
            r = int(255 - (255 - r1) * (255 - r2) / 255)
            g = int(255 - (255 - g1) * (255 - g2) / 255)
            b = int(255 - (255 - b1) * (255 - b2) / 255)
            
            # Apply mask
            r1 = int(r1 * (1 - m) + r * m)
            g1 = int(g1 * (1 - m) + g * m)
            b1 = int(b1 * (1 - m) + b * m)
            
            pixels1[x, y] = (r1, g1, b1, 255)

screen_blend(img, glow_resized, mask)

img.save('assets/app-icon-square-v23.png')
img.save('assets/app-icon-square.png')
img.save('assets/icon.png')
img.save('assets/splash-icon.png')
print("Successfully generated v23 with mirrored text erasure and intense glow!")
