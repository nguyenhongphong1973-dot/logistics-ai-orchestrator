import urllib.request, io, math, os, sys
from PIL import Image
os.makedirs('sat', exist_ok=True)
UA={'User-Agent':'Mozilla/5.0'}
def get(u):
    return urllib.request.urlopen(urllib.request.Request(u,headers=UA),timeout=60).read()
boxes={'site':(106.8040,20.8110,106.8175,20.8210,2400,1780),'area':(106.7650,20.8050,106.8250,20.8450,2400,1600)}
for n,(x1,y1,x2,y2,w,h) in boxes.items():
    try:
        u=f'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/export?bbox={x1},{y1},{x2},{y2}&bboxSR=4326&imageSR=3857&size={w},{h}&format=jpg&f=image'
        open(f'sat/esri_{n}.jpg','wb').write(get(u)); print('esri',n,'ok')
    except Exception as e: print('esri',n,e)
def tile(lat,lon,z):
    n=2**z; x=(lon+180)/360*n; y=(1-math.log(math.tan(math.radians(lat))+1/math.cos(math.radians(lat)))/math.pi)/2*n; return x,y
for z in (17,18):
    lon1,lat1,lon2,lat2=106.8040,20.8210,106.8175,20.8110
    xa,ya=tile(lat1,lon1,z); xb,yb=tile(lat2,lon2,z)
    X=range(int(xa),int(xb)+1); Y=range(int(ya),int(yb)+1)
    img=Image.new('RGB',(256*len(X),256*len(Y)))
    try:
        for i,x in enumerate(X):
            for j,y in enumerate(Y):
                t=Image.open(io.BytesIO(get(f'https://mt{(x+y)%4}.google.com/vt/lyrs=s&x={x}&y={y}&z={z}')))
                img.paste(t.convert('RGB'),(256*i,256*j))
        img.save(f'sat/google_z{z}.jpg',quality=88)
        open(f'sat/google_z{z}.txt','w').write(f'x0={int(xa)} y0={int(ya)} nx={len(X)} ny={len(Y)} z={z}\n'); print('google',z,'ok')
    except Exception as e: print('google',z,e)
