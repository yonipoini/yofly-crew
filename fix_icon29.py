from PIL import Image

img = Image.open('assets/logo.png').convert('RGBA')
pixels = img.load()

# Find the first row containing non-dark pixels (the top of the text)
# We scan from y=500 downwards. The text is bright pink/blue.
text_top = -1
for y in range(500, 1024):
    found = False
    for x in range(1536):
        r, g, b, a = pixels[x, y]
        if r > 50 or g > 50 or b > 50: # text is bright
            text_top = y
            found = True
            break
    if found:
        break

print(f"Text starts at y={text_top}")
