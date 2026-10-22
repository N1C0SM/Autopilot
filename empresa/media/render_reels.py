# Reels 1080x1920 a partir de las mismas diapositivas que los carruseles (render_carousel.C).
import os, sys, subprocess
from PIL import Image
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))
import render_carousel as rc
W,H,FPS=1080,1920,30
Y0=(H-rc.H)//2
ease=lambda t: 1-(1-max(0,min(1,t)))**3
def mask():
    m=Image.new("L",(rc.W,rc.H),255); px=m.load(); f=140
    for y in range(f):
        a=int(255*y/f)
        for x in range(rc.W): px[x,y]=min(px[x,y],a); px[x,rc.H-1-y]=min(px[x,rc.H-1-y],a)
    return m
M=mask()
def render(key,out):
    S=rc.slides(rc.C[key]); n=len(S)
    imgs=[fn(i,n) for i,fn in enumerate(S)]
    dur=[3.2]+[4.2]*(n-3)+[2.4,4.5]
    starts=[sum(dur[:i]) for i in range(n)]; total=sum(dur)
    p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-",
        "-f","lavfi","-i","anullsrc=r=44100:cl=stereo","-shortest","-c:v","libx264","-pix_fmt","yuv420p","-preset","medium","-crf","20",
        "-c:a","aac","-movflags","+faststart",out],stdin=subprocess.PIPE)
    for f in range(int(total*FPS)):
        t=f/FPS; i=max(k for k in range(n) if starts[k]<=t); lt=t-starts[i]
        a=ease(lt/0.45); z=1.0+0.025*(lt/dur[i])
        im=imgs[i].resize((int(rc.W*z),int(rc.H*z)),Image.BILINEAR).crop((0,0,rc.W,rc.H))
        fr=Image.new("RGB",(W,H),rc.BG)
        fr.paste(im,(0,Y0+int((1-a)*60)),M.point(lambda v:int(v*a)))
        bar=Image.new("RGB",(int((W-160)*t/total) or 1,6),rc.GOLD); fr.paste(Image.new("RGB",(W-160,6),rc.LINE),(80,Y0-60)); fr.paste(bar,(80,Y0-60))
        p.stdin.write(fr.tobytes())
    p.stdin.close(); p.wait()
if __name__=="__main__":
    out=os.environ.get("OUT",os.path.dirname(os.path.abspath(__file__)))
    for k in (sys.argv[1:] or rc.C): render(k,f"{out}/{k}.mp4"); print(k)
