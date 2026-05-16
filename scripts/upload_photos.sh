#!/bin/bash
# Upload photos to Supabase storage at web resolution
# Usage: ./upload_photos.sh <folder> <prefix>

FOLDER="$1"
PREFIX="$2"
SUPABASE_URL="https://dmtslzwglpezympptqls.supabase.co"
SERVICE_KEY="${SUPABASE_SERVICE_ROLE_KEY}"
BUCKET="grad-photos"
TMPDIR=$(mktemp -d)
OUTFILE="/tmp/${PREFIX}_urls.txt"
> "$OUTFILE"

echo "Processing photos from: $FOLDER"
echo "Uploading to prefix: blog/${PREFIX}/"

for FILE in "$FOLDER"/*.jpg "$FOLDER"/*.JPG; do
  [ -f "$FILE" ] || continue
  BASENAME=$(basename "$FILE" | sed 's/\.[Jj][Pp][Gg]$//')
  TMPFILE="$TMPDIR/${BASENAME}.jpg"

  # Resize to max 3000px on long edge, 90% quality
  sips -s format jpeg -s formatOptions 90 --resampleHeightWidthMax 3000 "$FILE" --out "$TMPFILE" > /dev/null 2>&1

  STORAGE_PATH="blog/${PREFIX}/${BASENAME}.jpg"

  # Upload via Supabase Storage API
  RESPONSE=$(curl -s -w "\n%{http_code}" -X POST \
    "${SUPABASE_URL}/storage/v1/object/${BUCKET}/${STORAGE_PATH}" \
    -H "Authorization: Bearer ${SERVICE_KEY}" \
    -H "apikey: ${SERVICE_KEY}" \
    -H "Content-Type: image/jpeg" \
    -H "x-upsert: true" \
    --data-binary "@$TMPFILE")

  HTTP_CODE=$(echo "$RESPONSE" | tail -1)
  if [ "$HTTP_CODE" = "200" ] || [ "$HTTP_CODE" = "201" ]; then
    URL="${SUPABASE_URL}/storage/v1/object/public/${BUCKET}/${STORAGE_PATH}"
    echo "$BASENAME: $URL"
    echo "$BASENAME|$URL" >> "$OUTFILE"
  else
    echo "FAILED $BASENAME: $HTTP_CODE - $(echo "$RESPONSE" | head -1)"
  fi
done

rm -rf "$TMPDIR"
echo ""
echo "Done. URLs saved to $OUTFILE"
