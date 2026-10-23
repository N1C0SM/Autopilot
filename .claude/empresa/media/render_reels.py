import sys, math, subprocess, os
from PIL import Image, ImageDraw, ImageFont
W,H,FPS=1080,1920,30
BG=(11,11,12); FG=(245,243,238); GOLD=(212,176,90); MUTED=(150,146,138)
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; R="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
def F(p,s): return ImageFont.truetype(p,s)
ease=lambda t: 1-(1-max(0,min(1,t)))**3
REELS={
 "dominada":[("3 ERRORES","que te impiden hacer\ntu primera dominada",None),
   ("01","Colgarte y tirar sin más.","Empieza por remos invertidos\ny negativas lentas de 3-5 s."),
   ("02","Olvidarte de la escápula.","Activa los dorsales colgado\nantes de doblar los brazos."),
   ("03","Ir al fallo cada día.","La fuerza llega con series\nde calidad y descanso."),
   ("CTA","Atlas de\nprogresiones","29,90 €")],
 "nutricion":[("SIN MITOS","Perder grasa y ganar\nmúsculo a la vez.",None),
   ("01","Sin dietas\nrestrictivas.","Aprende a comer,\nno a pasar hambre."),
   ("02","Proteína en\ncada comida.","La base para mantener\ny ganar músculo."),
   ("03","Rigor, no modas.","Guía visual basada\nen la ciencia."),
   ("CTA","Nutrición y\nrecomposición","19,90 €")],
 "blueprint":[("12 SEM","de entrenamiento\ncon un plan claro.",None),
   ("01","Diagnóstico inicial.","Sabes de dónde partes."),
   ("02","Fuerza → hipertrofia.","Bloques ordenados,\nsin improvisar."),
   ("03","Seguimiento semanal.","Medidas y progreso\nque puedes ver."),
   ("CTA","Blueprint\nTransformación","49,90 €")],
 "pack":[("3 GUÍAS","Un solo pack.",None),
   ("BASE","Base de fuerza","Estructura para dejar\nde improvisar."),
   ("ATLAS","Atlas de progresiones","De la base al dominio\nen calistenia."),
   ("12 SEM","Blueprint Transformación","Tu plan completo\nde 12 semanas."),
   ("CTA","Pack completo","Por separado 99,70 €|29,90 €")],
 "fuerza":[("¿POR QUÉ?","Entrenas, pero\nno ganas fuerza.",None),
   ("01","Cambias de rutina\ncada semana.",None),
   ("02","No apuntas pesos\nni repeticiones.",None),
   ("03","Descansas poco.","2-3 min en los ejercicios\nprincipales."),
   ("CTA","Base de fuerza","19,90 €")],
}
SL=2.6
def text_block(d,x,y,txt,font,col,alpha,dy,lh):
    for i,line in enumerate(txt.split("\n")):
        a=ease(alpha-i*0.12); 
        c=tuple(int(BG[k]+(col[k]-BG[k])*a) for k in range(3))
        d.text((x,y+i*lh+(1-a)*dy),line,font=font,fill=c)
    return y+len(txt.split("\n"))*lh
def frame(slides,f):
    t=f/FPS; n=len(slides); idx=min(int(t//SL),n-1); lt=t-idx*SL
    im=Image.new("RGB",(W,H),BG); d=ImageDraw.Draw(im)
    # subtle moving grid
    off=int((t*40)%120)
    for gx in range(-120,W+120,120): d.line([(gx+off,0),(gx+off-300,H)],fill=(20,20,22),width=2)
    # progress bar
    d.rectangle([80,120,W-80,126],fill=(35,35,38)); d.rectangle([80,120,80+(W-160)*min(1,t/(n*SL)),126],fill=GOLD)
    d.text((80,150),"AUTOPILOT",font=F(B,34),fill=MUTED)
    head,title,sub=slides[idx]; a=lt/0.6; out=ease((lt-(SL-0.35))/0.35) if idx<n-1 else 0
    a=a*(1-out)
    x=80; y=680
    if head=="CTA":
        s=1+0.03*math.sin(t*6)
        bw,bh=int(920*s),int(180*s); bx=(W-bw)//2; by=1400
        d.rounded_rectangle([bx,by,bx+bw,by+bh],radius=90,fill=GOLD)
        ft=F(B,64); tw=d.textlength("Enlace en la bio",font=ft)
        d.text(((W-tw)//2,by+bh//2-36),"Enlace en la bio",font=ft,fill=BG)
        y=text_block(d,x,640,title,F(B,84),FG,a*1.2,80,100)
        parts=sub.split("|")
        if len(parts)>1: y=text_block(d,x,y+30,parts[0],F(R,56),MUTED,a*1.2-0.2,60,70)
        text_block(d,x,y+30,parts[-1],F(B,170),GOLD,a*1.2-0.4,80,190)
        return im
    hf=F(B,190 if len(head)<=4 else 150)
    y=text_block(d,x,y,head,hf,GOLD,a*1.3,120,200)
    w=int((W-160)*ease(lt/0.8)*(1-out)); d.rectangle([x,y+20,x+w,y+30],fill=GOLD)
    y=text_block(d,x,y+80,title,F(B,74),FG,a*1.3-0.25,90,90)
    if sub: text_block(d,x,y+50,sub,F(R,56),MUTED,a*1.3-0.5,60,72)
    return im
name=sys.argv[1]; slides=REELS[name]; out=sys.argv[2]
N=int(len(slides)*SL*FPS)+FPS
p=subprocess.Popen(["ffmpeg","-y","-loglevel","error","-f","rawvideo","-pix_fmt","rgb24","-s",f"{W}x{H}","-r",str(FPS),"-i","-","-f","lavfi","-i","anullsrc=r=44100:cl=stereo","-shortest","-c:v","libx264","-pix_fmt","yuv420p","-preset","medium","-crf","20","-c:a","aac","-movflags","+faststart",out],stdin=subprocess.PIPE)
for f in range(N): p.stdin.write(frame(slides,min(f,N-FPS-1)).tobytes())
p.stdin.close(); p.wait()
frame(slides,int(1.2*FPS)).save(out.replace(".mp4","_f1.png")); frame(slides,int((len(slides)-1)*SL*FPS+20)).save(out.replace(".mp4","_cta.png"))
