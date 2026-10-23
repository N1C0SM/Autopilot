import os, math
from PIL import Image, ImageDraw, ImageFont, ImageFilter
W,H=1080,1350
BG=(10,10,11); CARD=(24,24,27); FG=(246,244,239); GOLD=(214,178,92); MUTED=(150,146,138); LINE=(40,40,44)
B="/usr/share/fonts/truetype/liberation/LiberationSans-Bold.ttf"; R="/usr/share/fonts/truetype/liberation/LiberationSans-Regular.ttf"
F=lambda p,s: ImageFont.truetype(p,s)
URL="autopilotplan.com/recursos"
def wrap(d,txt,font,maxw):
    out=[]
    for para in txt.split("\n"):
        line=""
        for w in para.split(" "):
            t=(line+" "+w).strip()
            if d.textlength(t,font=font)<=maxw: line=t
            else: out.append(line); line=w
        out.append(line)
    return out
def para(d,x,y,txt,font,col,maxw,lh):
    for l in wrap(d,txt,font,maxw): d.text((x,y),l,font=font,fill=col); y+=lh
    return y
def base(i,n):
    im=Image.new("RGB",(W,H),BG)
    glow=Image.new("RGB",(W,H),BG); g=ImageDraw.Draw(glow)
    g.ellipse([W-520,-380,W+380,420],fill=(60,48,22)); glow=glow.filter(ImageFilter.GaussianBlur(160))
    im=Image.blend(im,glow,0.9); d=ImageDraw.Draw(im)
    d.text((80,84),"AUTOPILOT",font=F(B,32),fill=GOLD)
    t=f"{i+1}/{n}"; d.text((W-80-d.textlength(t,font=F(B,32)),84),t,font=F(B,32),fill=MUTED)
    d.line([(80,H-120),(W-80,H-120)],fill=LINE,width=2)
    d.text((80,H-96),"@autopilotoficial__",font=F(R,32),fill=MUTED)
    return im,d
def cover(c,i,n):
    im,d=base(i,n)
    d.rounded_rectangle([80,230,80+d.textlength(c["tag"],font=F(B,34))+56,290],radius=30,outline=GOLD,width=3)
    d.text((108,240),c["tag"],font=F(B,34),fill=GOLD)
    y=para(d,80,360,c["hook"],F(B,118),FG,W-160,128)
    y=para(d,80,y+30,c["sub"],F(R,50),MUTED,W-160,64)
    d.rounded_rectangle([80,H-260,420,H-170],radius=45,fill=GOLD)
    d.text((122,H-240),"Desliza  →",font=F(B,44),fill=BG)
    return im
def point(c,p,i,n):
    im,d=base(i,n)
    num,title,body,tip=p
    d.text((80,200),num,font=F(B,220),fill=GOLD)
    y=para(d,80,470,title,F(B,76),FG,W-160,88)
    y=para(d,80,y+24,body,F(R,46),MUTED,W-160,62)
    if tip:
        ft=F(R,42); lines=wrap(d,tip,ft,W-160-120); h=60+len(lines)*56+40
        y=max(y+50,H-170-h-40)
        d.rounded_rectangle([80,y,W-80,y+h],radius=36,fill=CARD)
        d.rectangle([80,y+30,88,y+h-30],fill=GOLD)
        d.text((130,y+34),"CONSEJO",font=F(B,30),fill=GOLD)
        yy=y+84
        for l in lines: d.text((130,yy),l,font=ft,fill=FG); yy+=56
    return im
def save(c,i,n):
    im,d=base(i,n)
    cx,cy=W//2,470
    d.polygon([(cx-90,cy-130),(cx+90,cy-130),(cx+90,cy+130),(cx,cy+60),(cx-90,cy+130)],outline=GOLD,width=10)
    t="Guárdalo"; ft=F(B,110); d.text(((W-d.textlength(t,font=ft))//2,680),t,font=ft,fill=FG)
    for k,l in enumerate(wrap(d,c["save"],F(R,48),W-200)):
        d.text(((W-d.textlength(l,font=F(R,48)))//2,830+k*64),l,font=F(R,48),fill=MUTED)
    return im
def cta(c,i,n):
    im,d=base(i,n)
    d.text((80,220),"SI QUIERES EL MÉTODO COMPLETO",font=F(B,34),fill=GOLD)
    y=para(d,80,300,c["book"],F(B,96),FG,W-160,106)
    y=para(d,80,y+20,c["what"],F(R,46),MUTED,W-160,62)
    if c.get("old"):
        ft=F(R,52); d.text((80,y+50),c["old"],font=ft,fill=MUTED); tw=d.textlength(c["old"],font=ft)
        d.line([(80,y+82),(80+tw,y+82)],fill=MUTED,width=4); y+=70
    d.text((80,y+50),c["price"],font=F(B,170),fill=GOLD)
    d.text((80,y+240),"Pago único · PDF · descarga inmediata",font=F(R,40),fill=MUTED)
    bx,by=80,H-330
    d.rounded_rectangle([bx,by,W-80,by+150],radius=75,fill=GOLD)
    ft=F(B,52); d.text(((W-d.textlength(URL,font=ft))//2,by+46),URL,font=ft,fill=BG)
    return im
C={
"atlas":dict(tag="CALISTENIA",hook="Tu primera dominada",sub="3 errores que la frenan (y qué hacer en su lugar).",
 pts=[("01","Tirar sin base","Si aún no haces ninguna, colgarte y tirar no te acerca.","Remo invertido + negativas: baja en 3-5 s, 3-4 series de 3-5."),
      ("02","Olvidar la escápula","Sin escápula activa, tiran los brazos y no la espalda.","Colgado, baja los hombros lejos de las orejas sin doblar codos. 3×10."),
      ("03","Ir al fallo cada día","El fallo constante acumula fatiga y frena el progreso.","Deja 1-2 repeticiones en reserva y entrena tirón 2-3 días por semana.")],
 save="Para tu próximo día de tirón.",book="Atlas de progresiones",what="Progresiones paso a paso: dominadas, fondos, L-sit, front lever, planche y más.",price="29,90 €"),
"nutricion":dict(tag="NUTRICIÓN",hook="Perder grasa sin pasar hambre",sub="3 bases que funcionan mejor que cualquier dieta de moda.",
 pts=[("01","Proteína en cada comida","Ayuda a conservar músculo y te deja más saciado.","Una ración del tamaño de tu palma en cada comida principal."),
      ("02","Déficit pequeño","Recortar mucho dispara el hambre y es difícil de mantener.","Busca perder alrededor del 0,5-1 % de tu peso por semana."),
      ("03","Volumen en el plato","Verdura y fruta llenan con pocas calorías.","Medio plato de verdura en comida y cena.")],
 save="Para la próxima vez que hagas la compra.",book="Nutrición y recomposición",what="Guía visual sin mitos para perder grasa y ganar músculo.",price="19,90 €"),
"base":dict(tag="FUERZA",hook="Entrenas y no ganas fuerza",sub="3 motivos frecuentes y cómo corregirlos.",
 pts=[("01","Cambias de rutina","Cada cambio reinicia la adaptación.","Mantén los ejercicios principales al menos 6-8 semanas."),
      ("02","No apuntas nada","Sin registro no sabes si progresas.","Anota peso y repeticiones; intenta superar una de las dos."),
      ("03","Descansas poco","En los básicos, la fatiga te quita repeticiones.","2-3 minutos entre series de los ejercicios principales.")],
 save="Para tu próximo día de gimnasio.",book="Base de fuerza",what="La estructura para dejar de improvisar y progresar con un método.",price="19,90 €"),
"blueprint":dict(tag="12 SEMANAS",hook="Un plan, no improvisar",sub="Cómo se estructura una transformación de 12 semanas.",
 pts=[("01","Diagnóstico","Medidas, fotos y marcas de partida.","Repite las mismas medidas cada 2 semanas, en las mismas condiciones."),
      ("02","Fuerza → hipertrofia","Primero construyes base; luego, volumen.","Sube la carga cuando completes todas las series con buena técnica."),
      ("03","Seguimiento semanal","Ajustas según datos, no según sensaciones.","Revisa peso medio semanal, no el de un solo día.")],
 save="Para empezar tu próximo bloque.",book="Blueprint Transformación",what="Programa de 12 semanas: diagnóstico, fuerza, hipertrofia, seguimiento y nutrición.",price="49,90 €"),
"pack":dict(tag="PACK",hook="3 guías. Un solo pago.",sub="Todo lo que necesitas para entrenar con método.",
 pts=[("01","Base de fuerza","Estructura para dejar de improvisar en el gimnasio.",None),
      ("02","Atlas de progresiones","De la base al dominio en calistenia.",None),
      ("03","Blueprint Transformación","Tu plan completo de 12 semanas.",None)],
 save="Para cuando decidas empezar en serio.",book="Pack completo Autopilot",what="Base de fuerza + Atlas de progresiones + Blueprint Transformación.",old="99,70 € por separado",price="29,90 €"),
}
def slides(c):
    return [lambda i,n,c=c: cover(c,i,n)]+[lambda i,n,p=p,c=c: point(c,p,i,n) for p in c["pts"]]+[lambda i,n,c=c: save(c,i,n), lambda i,n,c=c: cta(c,i,n)]
if __name__=="__main__":
    out=os.environ["OUT"]; os.makedirs(out,exist_ok=True)
    for k,c in C.items():
        S=slides(c)
        for i,fn in enumerate(S): fn(i,len(S)).save(f"{out}/{k}-{i+1}.jpg",quality=92)
