"""Measure real world joint/socket transforms, export round-trip and render props.
CHECK_ONLY=1 skips renders. Render samples include both endpoints (33 at 30 fps).
"""
import bpy,os,json,math
from mathutils import Vector,Matrix
ROOT=os.getcwd();OUT='evidence/weapon-motion-v1';os.makedirs(OUT,exist_ok=True)
report={'coordinates':'Blender meters, front -Y, up +Z','heroes':{},'errors':[]}
cal=Matrix(((0,0,1),(0,-1,0),(1,0,0))).to_quaternion()
for hero in ['ranger','vanguard']:
 bpy.ops.wm.open_mainfile(filepath=f'{ROOT}/art-source/{hero}/blender-weapon-motion-v1/{hero}.blend')
 scene=bpy.context.scene;rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
 styles={'saber':['Saber1','Saber2','Saber3'],'spear':['SpearAttack'],'greatblade':['GreatbladeAttack']} if hero=='vanguard' else {w:[w.title()+'Shot'] for w in ['shortbow','longbow','fanbow']}
 props=[o for o in bpy.data.objects if o.name.startswith(('prop.','string.'))]
 scene.cycles.samples=4;scene.cycles.use_denoising=True;scene.render.resolution_x=320;scene.render.resolution_y=384
 scene.camera.data.ortho_scale=3.6;scene.camera.location=(-3.5,-5,2.5);scene.camera.rotation_euler=(Vector((0,-.1,1.15))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
 data={'clips':{},'localBoneAxes':{n:[list(rig.data.bones[n].matrix_local.to_3x3().col[i]) for i in range(3)] for n in ['arm.R','forearm.R','hand.R','hand.L']},'identity':rig.get('identity'),'joints':len(rig.data.bones)}
 for w,clips in styles.items():
  for o in props:o.hide_render=not o.name.endswith('.'+w)
  for clip in clips:
   scene.camera.location=(3,-5,3.5) if w=='greatblade' else (-3.5,-5,2.5)
   scene.camera.rotation_euler=(Vector((0,-.1,1.15))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
   rig.animation_data.action=bpy.data.actions[clip];rows=[]
   for k in range(513):
    f=1+k/4;scene.frame_set(int(f),subframe=f%1);bpy.context.view_layer.update()
    socket=rig.pose.bones['socket.'+w].matrix
    q=socket.to_quaternion();grip=socket.translation
    side='R' if hero=='vanguard' else 'L'
    hand=rig.pose.bones['hand.'+side].matrix
    primary=(hand@Vector((0,.065,0))-grip).length
    orientation=(hand.to_quaternion().rotation_difference(q@cal)).angle
    support=None;string=None
    if w in ['spear','greatblade']:
     support=(rig.pose.bones['hand.L'].matrix@Vector((0,.065,0))-socket@Vector((0,0,.18 if w=='spear' else -.18))).length
    if hero=='ranger':
     nock=rig.pose.bones[w+'.nock'].matrix@Vector((0,.40,0))
     string=(rig.pose.bones['hand.R'].matrix@Vector((0,.065,0))-nock).length
    rows.append({'phase':k/512,'handGripError':primary,'orientationRadians':min(orientation,abs(2*math.pi-orientation)),'supportError':support,'stringError':string,'grip':list(grip),'hands':{s:list(rig.pose.bones['hand.'+s].matrix@Vector((0,.065,0))) for s in ['R','L']},'legs':{s:{n:list(rig.pose.bones[n+'.'+s].head) for n in ['thigh','shin','foot']} for s in ['R','L']}})
   maximum={key:max((r[key] or 0) for r in rows if key!='stringError' or r['phase']==0 or r['phase']>=.34) for key in ['handGripError','orientationRadians','supportError','stringError']}
   maximum['releaseHandStringSeparation']=max(r['stringError'] or 0 for r in rows)
   if maximum['handGripError']>.002 or maximum['supportError']>.002 or maximum['stringError']>.002 or maximum['orientationRadians']>.01:report['errors'].append([hero,clip,maximum])
   data['clips'][clip]={'maxima':maximum,'samples':rows}
   print(hero,clip,maximum,flush=True)
   if not os.environ.get('CHECK_ONLY'):
    folder=f'{OUT}/{clip}';os.makedirs(folder,exist_ok=True)
    for k in range(33):
     scene.frame_set(k*4+1);scene.render.filepath=f'{ROOT}/{folder}/{k:03}.png';bpy.ops.render.render(write_still=True)
 if hero=='vanguard' and not os.environ.get('CHECK_ONLY'):
  scene.render.resolution_x=600;scene.render.resolution_y=720;scene.cycles.samples=8
  for w,clip in [('spear','SpearAttack'),('greatblade','GreatbladeAttack')]:
   for o in props:o.hide_render=not o.name.endswith('.'+w)
   rig.animation_data.action=bpy.data.actions[clip]
   for phase in [0,.5]:
    scene.frame_set(1+int(128*phase))
    for view,pos in [('front',(1,-5,3.3)),('right',(-5,-1,2.3))]:
     scene.camera.location=pos;scene.camera.data.ortho_scale=3.3
     scene.camera.rotation_euler=(Vector((0,-.1,1.35))-scene.camera.location).to_track_quat('-Z','Y').to_euler()
     scene.render.filepath=f'{ROOT}/{OUT}/{w}-grips-{view}-{phase}.png';bpy.ops.render.render(write_still=True)
 # Actual Ranger neutral/reference renders without weapons to assess identity.
 if hero=='ranger' and not os.environ.get('CHECK_ONLY'):
  for o in props:o.hide_render=True
  rig.animation_data.action=bpy.data.actions['Idle'];scene.frame_set(1)
  scene.camera.data.ortho_scale=2.5;scene.render.resolution_x=600;scene.render.resolution_y=720
  for view,pos in [('front',(0,-5,1.1)),('right',(-5,0,1.1)),('back',(0,5,1.1))]:
   scene.camera.location=pos;scene.camera.rotation_euler=(Vector((0,0,1.1))-scene.camera.location).to_track_quat('-Z','Y').to_euler();scene.render.filepath=f'{ROOT}/{OUT}/ranger-{view}.png';bpy.ops.render.render(write_still=True)
 report['heroes'][hero]=data
open(f'{OUT}/world-grip-checks.json','w').write(json.dumps(report,indent=2))
assert not report['errors'],report['errors']
