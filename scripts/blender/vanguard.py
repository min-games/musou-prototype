"""Blender 4.5: deterministic first-pass Vanguard. Run from repository root.
blender -b --python scripts/blender/vanguard.py
Only character geometry/armature are exported; packed image empties stay in .blend.
"""
import bpy, math, os, json
from mathutils import Vector
from math import sin, cos, pi
ROOT=os.getcwd(); OUT=os.path.join(ROOT,'art-source/vanguard/blender-v1'); EVID=os.path.join(ROOT,'evidence/blender-v1')
os.makedirs(OUT,exist_ok=True); os.makedirs(EVID,exist_ok=True)
bpy.ops.object.select_all(action='SELECT'); bpy.ops.object.delete(use_global=False)
M={}
for name,color,metal,rough in [('Iron',(0.065,.073,.087),.55,.52),('Gold',(.67,.36,.085),.72,.32),('Red',(.42,.018,.025),0,.82),('Skin',(.54,.29,.16),0,.72),('Hair',(.025,.014,.012),0,.85),('Ivory',(.9,.76,.49),.12,.55),('Eye',(.014,.009,.006),0,.3)]:
 m=bpy.data.materials.new(name); m.diffuse_color=(*color,1); m.use_nodes=True
 bs=m.node_tree.nodes.get('Principled BSDF'); bs.inputs['Base Color'].default_value=(*color,1); bs.inputs['Metallic'].default_value=metal; bs.inputs['Roughness'].default_value=rough; M[name]=m
parts=[]
def finish(o,name,mat,bone):
 o.name=name; o.data.materials.append(M[mat]); bpy.context.view_layer.objects.active=o
 bpy.ops.object.transform_apply(location=False,rotation=False,scale=True)
 vg=o.vertex_groups.new(name=bone); vg.add(list(range(len(o.data.vertices))),1,'REPLACE'); parts.append(o)
 return o
def ell(name,p,s,mat,bone,seg=16,rings=10):
 bpy.ops.mesh.primitive_uv_sphere_add(segments=seg,ring_count=rings,location=p); o=bpy.context.object; o.scale=s
 for f in o.data.polygons:f.use_smooth=True
 return finish(o,name,mat,bone)
def mesh(name,v,f,mat,bone):
 d=bpy.data.meshes.new(name); d.from_pydata(v,[],f); d.update(); o=bpy.data.objects.new(name,d); bpy.context.collection.objects.link(o);return finish(o,name,mat,bone)
def tube(name,points,r,mat,bone):
 # Round beveled curves converted to editable mesh, used for controlled relief and piping.
 d=bpy.data.curves.new(name,'CURVE');d.dimensions='3D';d.resolution_u=2;d.bevel_depth=r;d.bevel_resolution=1
 sp=d.splines.new('BEZIER');sp.bezier_points.add(len(points)-1)
 for b,p in zip(sp.bezier_points,points): b.co=p;b.handle_left_type='AUTO';b.handle_right_type='AUTO'
 o=bpy.data.objects.new(name,d);bpy.context.collection.objects.link(o);bpy.context.view_layer.objects.active=o;o.select_set(True)
 for q in bpy.context.selected_objects:
  if q!=o:q.select_set(False)
 bpy.ops.object.convert(target='MESH');return finish(bpy.context.object,name,mat,bone)
def rings(name,levels,mat,bone,n=12):
 # elliptical cross-sections (z, x radius, y radius, x center, y center)
 v=[(cx+rx*cos(2*pi*j/n),cy+ry*sin(2*pi*j/n),z) for z,rx,ry,cx,cy in levels for j in range(n)]
 f=[tuple(range(n-1,-1,-1))]
 for k in range(len(levels)-1):
  for j in range(n):a=k*n+j;b=k*n+(j+1)%n;f.append((a,b,b+n,a+n))
 f.append(tuple(range((len(levels)-1)*n,len(levels)*n)))
 return mesh(name,v,f,mat,bone)
def panel(name,x,y,z,w,h,mat,bone,flare=.04):
 v=[(x-w/2,y,z),(x+w/2,y,z),(x+w/2+flare,y-.035,z-h),(x-w/2-flare,y-.035,z-h)]
 o=mesh(name,v,[(0,1,2,3)],mat,bone); mod=o.modifiers.new('Plate thickness','SOLIDIFY');mod.thickness=.018
 bpy.context.view_layer.objects.active=o;bpy.ops.object.modifier_apply(modifier=mod.name)
 tube(name+' gold hem',[v[0],v[3],v[2],v[1]],.012,'Gold',bone)
 return o
# 2.18 m tall, broad chest, narrower mature head. Front is Blender -Y; anatomical RIGHT is -X.
rings('quilted undershirt',[(1.04,.24,.155,0,0),(1.35,.28,.15,0,0),(1.66,.30,.13,0,0)],'Red','chest')
rings('cuirass sculpted planes',[(1.14,.24,.16,0,0),(1.30,.29,.185,0,0),(1.53,.365,.205,0,0),(1.66,.31,.17,0,0)],'Iron','chest',16)
for z,rx,ry in [(1.18,.255,.171),(1.62,.325,.182)]:
 tube('cuirass rim',[(rx*cos(2*pi*j/24),ry*sin(2*pi*j/24),z) for j in range(25)],.013,'Gold','chest')
# central breastplate seam and ivory auspicious cloud relief
for x in [-.25,.25]:tube('breastplate ridge',[(x,-.158,1.2),(x*.65,-.20,1.39),(x*.9,-.19,1.61)],.008,'Gold','chest')
for x,z,r in [(.12,1.48,.034),(.17,1.47,.03),(.10,1.52,.023)]:
 tube('ivory cloud curl',[(x+r*cos(a),-.207,z+r*sin(a)) for a in [i*pi/8 for i in range(14)]],.01,'Ivory','chest')
tube('ivory cloud tail',[(.1,-.208,1.45),(.20,-.208,1.43),(.24,-.195,1.39)],.009,'Ivory','chest')
rings('waist wrap',[(.99,.255,.17,0,0),(1.10,.255,.17,0,0)],'Red','pelvis')
rings('leather belt',[(1.035,.264,.18,0,0),(1.09,.26,.18,0,0)],'Iron','pelvis')
panel('square buckle',0,-.195,1.098,.105,.095,'Gold','pelvis',0)
panel('buckle inset',0,-.219,1.078,.059,.054,'Iron','pelvis',0)
for x in [-.215,0,.215]:
 panel('front hip lamella',x,-.165,.99,.17,.31 if x else .33,'Iron','pelvis')
 panel('back hip lamella',x,.175,.99,.17,.30,'Iron','pelvis')
 if x:
  tube('stepped temple border',[(x-.055,-.21,.735),(x+.025,-.21,.735),(x+.025,-.20,.79),(x+.06,-.20,.79)],.009,'Gold','pelvis')
ell('sash knot',(.24,-.19,1.01),(.055,.04,.06),'Red','sash')
panel('sash tail',.26,-.215,.99,.09,.39,'Red','sash',.015)
panel('second sash tail',.32,-.16,.96,.06,.28,'Red','sash',0)
for sign,side in [(-1,'R'),(1,'L')]:
 x=sign*.155
 rings('trouser '+side,[(.35,.09,.09,x,0),(.48,.13,.12,x,0),(.68,.14,.135,x,0),(.91,.125,.12,x,0)],'Iron','thigh.'+side)
 # deliberate fabric folds, no texture requirement
 for j in range(3):tube('trouser fold',[(x-.08,-.10,.48+j*.11),(x+.015,-.13,.45+j*.11),(x+.09,-.08,.47+j*.11)],.011,'Iron','thigh.'+side)
 rings('boot greave',[(.095,.085,.09,x,0),(.18,.07,.08,x,0),(.44,.09,.09,x,0)],'Iron','shin.'+side)
 panel('greave face',x,-.091,.43,.14,.30,'Iron','shin.'+side,-.025)
 ell('boot toe', (x,-.06,.075),(.10,.175,.075),'Iron','shin.'+side)
 tube('boot welt',[(x+.1*cos(a),-.045+.165*sin(a),.033) for a in [i*pi/12 for i in range(25)]],.011,'Gold','shin.'+side)
 # arms lowered A-pose, upper sleeves with deliberate cuffs
 sx=sign*.39
 ell('red sleeve '+side,(sign*.415,0,1.48),(.13,.13,.20),'Red','arm.'+side)
 ell('elbow '+side,(sign*.48,0,1.32),(.09,.085,.12),'Skin','forearm.'+side)
 rings('vambrace '+side,[(1.06,.062,.071,sign*.55,0),(1.29,.087,.09,sign*.49,0)],'Iron','forearm.'+side)
 for z,cx,r in [(1.28,sign*.493,.09),(1.07,sign*.55,.065)]:
  tube('bracer gold cuff',[(cx+r*cos(a),r*sin(a),z) for a in [i*pi/10 for i in range(21)]],.014,'Gold','forearm.'+side)
 ell('fingerless glove',(sign*.566,0,1.025),(.071,.065,.085),'Iron','hand.'+side)
 for j in range(4):ell('finger',(sign*(.526+j*.026),-.015,.945),(.014,.026,.05),'Skin','hand.'+side,8,6)
 ell('thumb',(sign*.505,-.039,1.00),(.022,.026,.055),'Skin','hand.'+side,10,6)
 # pauldron plate and gold outer trim, right intentionally oversized
 rr=.185 if side=='R' else .145;cx=sign*.38
 ell('pauldron gold foundation',(cx,0,1.64),(rr,.16,.165),'Gold','arm.'+side)
 ell('pauldron charcoal inset',(cx,-.014,1.655),(rr*.91,.152,.14),'Iron','arm.'+side)
 if side=='R':
  ell('guardian lion relief',(-.405,-.154,1.66),(.13,.04,.123),'Gold','arm.R')
  for k in range(9):
   a=2*pi*k/9;xx=-.405+.115*cos(a);zz=1.66+.11*sin(a)
   tube('lion carved mane',[(xx+.035*cos(t+a),-.197,zz+.035*sin(t+a)) for t in [i*pi/6 for i in range(10)]],.015,'Gold','arm.R')
  for xx in [-.452,-.362]:
   ell('lion eye recess',(xx,-.198,1.686),(.03,.016,.019),'Iron','arm.R')
   ell('lion ivory eye',(xx,-.213,1.687),(.012,.008,.012),'Ivory','arm.R')
   tube('lion brow',[(xx-.034,-.21,1.71),(xx,-.222,1.724),(xx+.026,-.21,1.713)],.016,'Gold','arm.R')
  ell('lion muzzle',(-.405,-.216,1.635),(.067,.036,.043),'Gold','arm.R')
  ell('lion nose',(-.405,-.246,1.65),(.025,.012,.016),'Iron','arm.R')
  tube('lion mouth',[(-.456,-.24,1.62),(-.405,-.252,1.61),(-.355,-.24,1.62)],.008,'Iron','arm.R')
  for xx in [-.45,-.36]:ell('lion fang',(xx,-.236,1.607),(.01,.012,.023),'Ivory','arm.R',8,6)
# neck, layered red collar
ell('neck',(0,0,1.72),(.072,.073,.13),'Skin','head')
for sign in [-1,1]:
 tube('folded collar',[(sign*.20,.08,1.65),(sign*.15,-.07,1.70),(sign*.06,-.11,1.65)],.04,'Red','chest')
 tube('collar gold edge',[(sign*.09,-.085,1.78),(sign*.075,-.11,1.70),(sign*.025,-.12,1.65)],.009,'Gold','chest')
# face uses contour rings: tapered chin, square jaw, cheekbones, brow and cranium
rings('adult facial planes',[(1.77,.046,.055,0,-.028),(1.80,.074,.07,0,-.022),(1.86,.087,.078,0,-.015),(1.93,.087,.076,0,0),(2.01,.075,.065,0,.008)],'Skin','head',16)
ell('rear cranium',(0,.025,1.94),(.091,.078,.11),'Hair','head')
for sign in [-1,1]:
 ell('ear',(sign*.09,.001,1.89),(.018,.028,.04),'Skin','head',12,8)
 ell('ear inner',(sign*.103,-.012,1.892),(.008,.014,.022),'Red','head',8,6)
 ell('cheek plane',(sign*.052,-.065,1.863),(.029,.018,.027),'Skin','head')
 ell('eye socket',(sign*.039,-.072,1.916),(.028,.012,.012),'Hair','head')
 ell('eye white',(sign*.039,-.084,1.915),(.020,.005,.006),'Ivory','head',12,8)
 ell('iris',(sign*.037,-.090,1.915),(.007,.003,.008),'Eye','head',10,6)
 tube('stern brow',[(sign*.015,-.087,1.924),(sign*.040,-.091,1.937),(sign*.069,-.075,1.937)],.007,'Hair','head')
 tube('nasolabial plane',[(sign*.021,-.083,1.867),(sign*.034,-.080,1.85)],.003,'Skin','head')
# sculpted wedge nose and short beard following jaw rather than a ball
mesh('nose bridge',[(-.012,-.078,1.925),(.012,-.078,1.925),(-.017,-.10,1.869),(.017,-.10,1.869),(0,-.121,1.878)],[(0,1,4),(0,4,2),(1,3,4),(2,4,3)],'Skin','head')
for s in [-1,1]:
 tube('trimmed jaw beard',[(s*.077,-.042,1.856),(s*.063,-.066,1.807),(s*.028,-.074,1.784),(0,-.077,1.78)],.012,'Hair','head')
 tube('mustache',[(0,-.096,1.85),(s*.018,-.094,1.852),(s*.036,-.085,1.842)],.006,'Hair','head')
tube('lower lip',[(-.023,-.09,1.831),(0,-.096,1.828),(.023,-.09,1.831)],.004,'Skin','head')
for x in [-.018,0,.018]:tube('chin beard',[(x,-.085,1.815),(x*.65,-.084,1.785)],.006,'Hair','head')
for sign in [-1,1]:
 mesh('short beard cheek',[(sign*.075,-.052,1.855),(sign*.066,-.069,1.815),(sign*.022,-.079,1.783),(sign*.025,-.084,1.807),(sign*.054,-.073,1.822)],[(0,1,2,3,4)],'Hair','head')
# swept hair locks in tapered sculpted strands
for i in range(11):
 a=2*pi*i/11; x=.079*cos(a);y=.066*sin(a)+.014
 o=ell('swept hair lock',(x,y,1.995),(.028,.034,.085),'Hair','head',12,8);o.rotation_euler=(.2*sin(a),-.40*cos(a),a)
 tube('hair strand highlight',[(x*.5,y*.5,2.065),(x,y,2.015),(x*1.12,y*1.12,1.965)],.003,'Iron','head')
ell('topknot',(0,.035,2.09),(.056,.052,.073),'Hair','head')
tube('red topknot tie',[(.055*cos(a),.035+.052*sin(a),2.065) for a in [i*pi/8 for i in range(17)]],.012,'Red','head')
for k in range(2):
 mesh('two headband tails',[(.02,.06,2.065),(.07,.07,2.068),(.16+k*.045,.1,2.01-k*.04),(.19+k*.045,.12,1.98-k*.04),(.11,.09,2.005)],[(0,1,2,3,4)],'Red','head')
# Slightly enlarge the adult head against the broad shoulders and shorten the neck.
for o in parts:
 if 'head' in o.vertex_groups:
  for v in o.data.vertices:
   world=o.matrix_world @ v.co
   target=Vector((world.x*1.15,world.y*1.15,1.72+(world.z-1.72)*1.10-.035))
   v.co=o.matrix_world.inverted() @ target
# Skeleton with explicit sockets. Rigid armor weights, anatomical hinges, independent armature clones.
bpy.ops.object.select_all(action='DESELECT');bpy.ops.object.armature_add();rig=bpy.context.object;rig.name='VanguardRig';bpy.ops.object.mode_set(mode='EDIT');rig.data.edit_bones.remove(rig.data.edit_bones[0])
bones={}
def bone(n,h,t,parent=None):
 b=rig.data.edit_bones.new(n);b.head=h;b.tail=t
 if parent:b.parent=bones[parent]
 bones[n]=b
bone('root',(0,0,0),(0,0,.15));bone('pelvis',(0,0,.93),(0,0,1.14),'root');bone('chest',(0,0,1.14),(0,0,1.66),'pelvis');bone('head',(0,0,1.66),(0,0,2.04),'chest');bone('sash',(.24,0,1.02),(.24,0,.73),'pelvis')
for s,side in [(-1,'R'),(1,'L')]:
 bone('thigh.'+side,(s*.155,0,.93),(s*.155,0,.44),'pelvis');bone('shin.'+side,(s*.155,0,.44),(s*.155,-.01,.09),'thigh.'+side)
 bone('arm.'+side,(s*.32,0,1.64),(s*.48,0,1.32),'chest');bone('forearm.'+side,(s*.48,0,1.32),(s*.55,0,1.06),'arm.'+side);bone('hand.'+side,(s*.55,0,1.06),(s*.57,0,.95),'forearm.'+side)
bpy.ops.object.mode_set(mode='OBJECT')
bpy.ops.object.select_all(action='DESELECT')
for o in parts:o.select_set(True)
bpy.context.view_layer.objects.active=parts[0];bpy.ops.object.join();body=bpy.context.object;body.name='Vanguard armor cloth face';mod=body.modifiers.new('Vanguard skin','ARMATURE');mod.object=rig;body.parent=None
rig.animation_data_create();scene=bpy.context.scene;scene.render.fps=30
# Authored 30 fps cyclic idle, run with opposing limbs, and windup / strike / recovery.
for name,end in [('Idle',60),('Run',24),('Attack',24)]:
 act=bpy.data.actions.new(name);rig.animation_data.action=act
 for f in range(1,end+2):
  t=(f-1)/end;w=sin(t*2*pi)
  for p in rig.pose.bones:p.rotation_mode='XYZ';p.rotation_euler=(0,0,0);p.location=(0,0,0)
  if name=='Idle':
   rig.pose.bones['chest'].rotation_euler.x=.016*w;rig.pose.bones['sash'].rotation_euler.x=.025*w
  elif name=='Run':
   rig.pose.bones['pelvis'].location.y=.025*(1-cos(t*4*pi));rig.pose.bones['chest'].rotation_euler.x=.12
   for s,side in [(-1,'R'),(1,'L')]:
    rig.pose.bones['thigh.'+side].rotation_euler.x=s*w*.65;rig.pose.bones['shin.'+side].rotation_euler.x=-max(0,-s*w)*.9
    rig.pose.bones['arm.'+side].rotation_euler.x=-s*w*.45;rig.pose.bones['forearm.'+side].rotation_euler.x=-.3
   rig.pose.bones['sash'].rotation_euler.x=.25+.1*w
  else:
   # continuous finite attack: anticipation, strong cross body cut, recover to rest
   a=sin(pi*t);cut=sin(pi*min(1,max(0,(t-.2)/.65)))
   rig.pose.bones['chest'].rotation_euler.y=.30*sin(2*pi*t)
   rig.pose.bones['arm.R'].rotation_euler.x=-1.4*a
   rig.pose.bones['arm.R'].rotation_euler.z=-.6*cut
   rig.pose.bones['forearm.R'].rotation_euler.x=-.7*a
   rig.pose.bones['arm.L'].rotation_euler.x=-.25*a
   rig.pose.bones['head'].rotation_euler.y=-.12*sin(2*pi*t)
  for p in rig.pose.bones:
   p.keyframe_insert('rotation_euler',frame=f,group=p.name);p.keyframe_insert('location',frame=f,group=p.name)
 track=rig.animation_data.nla_tracks.new();track.name=name;strip=track.strips.new(name,1,act);strip.action_frame_end=end+1
rig.animation_data.action=None
for tr in rig.animation_data.nla_tracks:tr.mute=True
# Pack reference empties in their own hidden render collection for editable visual authoring.
refs=bpy.data.collections.new('REFERENCE IMAGES - original and turnaround');scene.collection.children.link(refs)
for i,path in enumerate(['art-source/vanguard/vanguard-front-v2-simple.png','art-source/vanguard/blender-v1/vanguard-turnaround-v1.png','art-source/vanguard/blender-v1/vanguard-animation-poses-v1.png']):
 im=bpy.data.images.load(os.path.join(ROOT,path));im.pack();o=bpy.data.objects.new('Reference '+str(i+1),None);o.empty_display_type='IMAGE';o.data=im;o.empty_display_size=3;o.location=(3+i*3,1,1.1);o.rotation_euler=(pi/2,0,0);refs.objects.link(o)
# Only selected skin and rig in standalone GLB; NLA strips export named animations.
bpy.ops.object.select_all(action='DESELECT');body.select_set(True);rig.select_set(True);bpy.context.view_layer.objects.active=rig
for tr in rig.animation_data.nla_tracks:tr.mute=False
bpy.ops.export_scene.gltf(filepath=os.path.join(ROOT,'public/models/vanguard-blender-v1.glb'),use_selection=True,export_format='GLB',export_animations=True,export_animation_mode='NLA_TRACKS',export_force_sampling=True,export_def_bones=False,export_texcoords=False)
for tr in rig.animation_data.nla_tracks:tr.mute=True
# Neutral studio render stage, never exported.
scene.render.engine='CYCLES';scene.cycles.samples=24;scene.render.resolution_x=800;scene.render.resolution_y=960;scene.render.resolution_percentage=100
scene.world.color=(.22,.22,.22);scene.view_settings.view_transform='AgX'
bpy.ops.mesh.primitive_plane_add(size=200);floor=bpy.context.object;floor.name='Studio floor - render only';floor.data.materials.append(M['Iron'])
def aim(o,p):o.rotation_euler=(Vector(p)-o.location).to_track_quat('-Z','Y').to_euler()
for p,power,size in [((2,-4,5),650,4),((-3,-1,3),450,3),((1,3,4),800,3)]:
 bpy.ops.object.light_add(type='AREA',location=p);o=bpy.context.object;o.data.energy=power;o.data.shape='DISK';o.data.size=size;aim(o,(0,0,1))
bpy.ops.object.camera_add(location=(0,-5,1.15));cam=bpy.context.object;cam.data.type='ORTHO';cam.data.ortho_scale=2.55;scene.camera=cam;aim(cam,(0,0,1.1))
rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1);bpy.ops.wm.save_as_mainfile(filepath=os.path.join(OUT,'vanguard.blend'))
for view,pos in [('front',(0,-5,1.15)),('right',(-5,0,1.15)),('back',(0,5,1.15))]:
 cam.location=pos;aim(cam,(0,0,1.1));scene.render.filepath=os.path.join(EVID,view+'.png');bpy.ops.render.render(write_still=True)
cam.location=(3,-5,2.35);aim(cam,(0,0,1.1))
for name,frame in [('Idle',16),('Run',7),('Attack',13),('Run',1),('Run',13),('Run',19),('Attack',6),('Attack',20)]:
 rig.animation_data.action=bpy.data.actions[name];scene.frame_set(frame);scene.render.filepath=os.path.join(EVID,name.lower()+'-'+str(frame)+'.png');bpy.ops.render.render(write_still=True)
rig.animation_data.action=None
for p in rig.pose.bones:p.rotation_euler=(0,0,0);p.location=(0,0,0)
print('VANGUARD COMPLETE',len(body.data.vertices),'vertices',len(body.data.polygons),'faces')
