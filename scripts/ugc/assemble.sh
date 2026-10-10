#!/bin/bash
# usage: assemble.sh <prefix> <out.mp4>  — joins <prefix>-s1..s3.mp4 into a 720x1280 ad with a CTA in the last 3 s
set -e
P=$1; OUT=$2; F=${FONT:-/usr/share/fonts/opentype/inter/Inter-ExtraBold.otf}  # set FONT=/path/to/bold.ttf on Mac/Windows
for s in s1 s2 s3; do
  ffmpeg -v error -y -i $P-$s.mp4 -vf "scale=720:1280:force_original_aspect_ratio=increase:flags=lanczos,crop=720:1280,fps=30,setsar=1" \
    -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a aac -b:a 160k -ar 44100 -ac 2 $P-$s-n.mp4
done
printf "file '%s'\n" $P-s1-n.mp4 $P-s2-n.mp4 $P-s3-n.mp4 > $P-list.txt
ffmpeg -v error -y -f concat -safe 0 -i $P-list.txt -c copy $P-joined.mp4
D=$(ffprobe -v error -show_entries format=duration -of csv=p=0 $P-joined.mp4)
T=$(python3 -c "print(max(0, $D-3))")
ffmpeg -v error -y -i $P-joined.mp4 -vf "drawtext=fontfile=$F:text='${CTA:-infobakery.com.br}':fontsize=52:fontcolor=white:box=1:boxcolor=0xE63B2E@0.92:boxborderw=22:x=(w-text_w)/2:y=h*0.80:enable='gte(t,$T)'" \
  -c:v libx264 -preset slow -crf 18 -pix_fmt yuv420p -c:a copy -movflags +faststart $OUT
ffprobe -v error -show_entries format=duration -of csv=p=0 $OUT
