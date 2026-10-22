import sys, os
sys.argv=[sys.argv[0],"x","x"]
src=open(os.path.join(os.path.dirname(__file__),"render.py")).read().split("name=sys.argv[1]")[0]
exec(src)
from PIL import Image, ImageDraw
CW,CH=1080,1350
def slide(slides,i):
    n=len(slides); head,title,sub=slides[i]
    im=Image.new("RGB",(CW,CH),BG); d=ImageDraw.Draw(im)
    for gx in range(-120,CW+400,120): d.line([(gx,0),(gx-300,CH)],fill=(20,20,22),width=2)
    d.text((80,90),"AUTOPILOT",font=F(B,34),fill=MUTED)
    # dots
    for k in range(n):
        x=CW-80-(n-1-k)*34; d.ellipse([x-8,104-8,x+8,104+8],fill=GOLD if k==i else (50,50,54))
    x=80
    if head=="CTA":
        y=text_block(d,x,330,title,F(B,84),FG,1,0,100)
        parts=sub.split("|")
        if len(parts)>1: y=text_block(d,x,y+30,parts[0],F(R,56),MUTED,1,0,70)
        text_block(d,x,y+30,parts[-1],F(B,170),GOLD,1,0,190)
        bx,by,bw,bh=80,CH-330,CW-160,170
        d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=85,fill=GOLD)
        ft=F(B,62); tw=d.textlength("Enlace en la bio",font=ft); d.text(((CW-tw)//2,by+bh//2-34),"Enlace en la bio",font=ft,fill=BG)
        return im
    y=text_block(d,x,330 if i else 380,head,F(B,190 if len(head)<=4 else 150),GOLD,1,0,200)
    d.rectangle([x,y+20,CW-80,y+30],fill=GOLD)
    y=text_block(d,x,y+80,title,F(B,74),FG,1,0,90)
    if sub: text_block(d,x,y+50,sub,F(R,56),MUTED,1,0,72)
    if i==0:
        d.text((x,CH-150),"Desliza →",font=F(B,48),fill=GOLD)
    return im
out=os.environ["OUT"]; os.makedirs(out,exist_ok=True)
for name,slides in REELS.items():
    for i in range(len(slides)): slide(slides,i).save(f"{out}/{name}-{i+1}.jpg",quality=92)
