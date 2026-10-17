"""Round-trip the real GLB and compare world joint heads to authored baked poses.
Blender --background --python scripts/blender/check-export.py
"""
import bpy,os,json,math
from mathutils import Vector
root=os.getcwd();out=os.path.join(root,'evidence/blender-run-v2')
source=json.load(open(os.path.join(out,'world-space-checks.json')))['samples']
bpy.ops.wm.read_factory_settings(use_empty=True)
bpy.context.scene.render.fps=30
bpy.ops.import_scene.gltf(filepath=os.path.join(root,'public/models/vanguard-blender-v1.glb'))
rig=next(o for o in bpy.data.objects if o.type=='ARMATURE')
rig.animation_data.action=next(a for a in bpy.data.actions if a.name=='Run')
rows=[];maximum=0
for f in range(25):
 bpy.context.scene.frame_set(f)
 legs={}
 for side in ['R','L']:
  joints={j:list(rig.matrix_world@rig.pose.bones[n+'.'+side].head) for j,n in [('hip','thigh'),('knee','shin'),('ankle','foot')]}
  for j,p in joints.items():maximum=max(maximum,(Vector(p)-Vector(source[f*4]['legs'][side][j])).length)
  legs[side]=joints
 rows.append({'frame':f,'legs':legs})
report={'maximumWorldJointRoundTripError':maximum,'localAxes':{p.name:[list(p.bone.matrix_local.to_3x3().col[i]) for i in range(3)] for p in rig.pose.bones if p.name.startswith(('thigh','shin','foot'))},'samples':rows}
open(os.path.join(out,'exported-world-joints.json'),'w').write(json.dumps(report,indent=2))
print('Maximum world joint round-trip error:',maximum)
assert maximum<.00001,maximum
