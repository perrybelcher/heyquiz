import type { FormSchemaType } from './schema';

// Original Pippi art direction. The same tokens power gallery previews and editable
// quiz themes, so choosing a design keeps its typography and colors in the player.
const palettes: Record<string, [string,string,string,'sans'|'serif'|'mono']> = {
 'Food & drink':['#75432a','#fbf3e6','#382c24','serif'],
 'Home & interiors':['#45624c','#eef2e9','#25372d','serif'],
 'Retail & gifts':['#913e59','#fff0f3','#482534','sans'],
 'Events & creative':['#6840a0','#f4edfc','#302046','sans'],
 'Travel & leisure':['#196a75','#e9f6f5','#183b42','serif'],
 'Education & coaching':['#285ba4','#edf3ff','#203550','sans'],
 'Fitness & hobbies':['#47632f','#f2f6e9','#303e26','sans'],
 'Home services':['#976029','#fff5e6','#49341e','sans'],
 'Professional services':['#354f79','#eef2f8','#22324e','sans'],
 'Property':['#78554a','#f8f0eb','#42312c','serif'],
 'Pets':['#8a5830','#fff5e7','#4a3526','sans'],
 'Community & nonprofit':['#25675c','#eaf5ee','#213f37','sans'],
 'Technology':['#5743ac','#f1efff','#2e2653','sans'],
};
const covers: Record<string,[string,string,string]> = {
 coffee:['Your next favorite cup starts here.','Bright and lively? Smooth and familiar? Discover a coffee direction that suits your taste.','Find my coffee style'],
 tea:['Make a little room for your tea moment.','A few thoughtful choices can turn an ordinary cup into a ritual you look forward to.','Find my tea moment'],
 'meal-planning':['Make dinner one less thing to figure out.','Find a meal-planning rhythm that works with your real week.','Find my rhythm'],
 'home-style':['A space that feels like you.','Explore the colors, textures, and small details you naturally gravitate toward.','Discover my style'],
 desk:['Make room for your best work.','Find a workspace direction that fits your space, your tools, and your day.','Find my setup'],
 garden:['Your next good thing could start in a pot.','Discover a gardening project that fits the space and attention you have.','Find my first project'],
 candles:['Set the mood. Make it yours.','Find a fragrance family for the way you want your home to feel.','Explore my scent style'],
 gifts:['Less guessing. More “you remembered.”','Start with the person, and find a thoughtful direction for their next gift.','Find a gift direction'],
 stationery:['A little more clarity for your day.','Find a planning format you will actually want to open.','Find my planning style'],
 photography:['Some moments deserve more than a snapshot.','Find the photography session that fits what you want to capture.','Find my session'],
 wedding:['Your day. Your decisions. The right support.','Discover which kind of planning help would make the process feel more manageable.','Explore our planning style'],
 'event-format':['Give people a reason to be in the room.','Choose an event format around what you want your audience to take away.','Find my event format'],
 travel:['What do you want to come home with?','A quieter mind, a new story, or a little adventure? Find your next getaway direction.','Find my getaway style'],
 hotel:['Find a stay that fits your kind of trip.','Focus on the location, comforts, and details you will actually use.','Find my stay style'],
 language:['What would you love to say next?','Find a learning approach that connects language practice to your real goals.','Find my learning approach'],
 course:['A better way to learn starts with you.','Explore a course format that fits how you learn and the time you have.','Find my course format'],
 career:['You do not need the whole map. Just a next step.','Find a practical direction for your next career-development effort.','Explore my next step'],
 'fitness-format':['Find a format you look forward to.','Explore movement-class settings that fit your schedule and preferences.','Explore my class format'],
 craft:['Make something. Surprise yourself.','Find an approachable creative project for the space, curiosity, and time you have.','Find my next hobby'],
 cleaning:['Come home to a clearer plan.','Find the kind of cleaning support that fits what your home needs next.','Find my cleaning service'],
 landscaping:['More life in your outdoor space.','Explore the right starting point for the garden or outdoor area you have.','Find my outdoor project'],
 renovation:['Make your home work better for you.','Start with what you want to change, then explore the right project scope.','Find my starting point'],
 'web-design':['A website with a clear job to do.','Find the project scope that fits where your business is going next.','Find my website direction'],
 branding:['Make your business easier to recognize.','Explore whether your next step is a clearer message, a visual refresh, or a new position.','Find my brand direction'],
 bookkeeping:['Make the records easier to work with.','Find a useful starting point for your next bookkeeping conversation.','Find my support path'],
 'virtual-assistant':['What could you take off your plate first?','Discover a manageable first task to delegate, with clear expectations.','Find my first handover'],
 'real-estate':['Your next move starts with a clearer brief.','Organize what matters before starting your next property conversation.','Find my property next step'],
 'pet-training':['A way to learn together.','Explore a training format that works for your schedule and learning preferences.','Explore class formats'],
 nonprofit:['There is more than one way to make a difference.','Find a contribution that fits your time, skills, and interests.','Find my way to help'],
 saas:['Find your way to your first useful result.','Choose an onboarding path that fits the way you like to learn a new tool.','Find my starting path'],
};
export function applyTemplateDesign(form:FormSchemaType,templateId:string,industry:string){
 const [primaryColor,backgroundColor,textColor,font]=palettes[industry]||palettes['Professional services'];
 const cover=covers[templateId];
 form.theme={...form.theme,primaryColor,backgroundColor,textColor,font,cardColor:'#ffffff',borderRadius:'lg',layout:'step'};
 if(form.coverPage){
  form.coverPage={...form.coverPage,...(cover?{title:cover[0],subtitle:cover[1],buttonText:cover[2]}:{buttonText:form.marketing?.kind==='scorecard'?'See my scorecard':'Find my next step'})};
 }
 return form;
}
