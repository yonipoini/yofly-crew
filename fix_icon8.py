from PIL import Image, ImageFilter, ImageDraw

# Start with the 1.6x scaled image which has no white corners
base = Image.open('assets/app-icon-square.png').convert('RGBA')

# Create a heavily blurred background to give that vibrant purple/blue glowing haze
blurred_bg = base.filter(ImageFilter.GaussianBlur(80))

# We want the logo to be sharp in the middle. We'll create a smooth radial mask.
mask = Image.new('L', (1024, 1024), 0)
draw = ImageDraw.Draw(mask)
# The logo fits roughly inside an 800x800 box in the center
draw.ellipse((112, 112, 912, 912), fill=255)

# Apply a massive blur to the mask to make the transition incredibly smooth
mask = mask.filter(ImageFilter.GaussianBlur(100))

# Composite the sharp image onto the blurred background
final_img = Image.composite(base, blurred_bg, mask)

final_img.save('/Users/yoni/.gemini/antigravity-ide/brain/4de2acdb-2f5c-4f3e-883b-2f1b09a17791/scratch/blur-icon.png')
print("Vibrant glowing blur icon created!")
