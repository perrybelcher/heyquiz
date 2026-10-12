// Literal expectations, authored from the preserved question/answer maps.
// Do not derive expected scores, coverage or conditional sections from the evaluator.
const common=['campaign-reflection','campaign-result-faq'];
const cat=(id,score,answered)=>({id,score,answered,applicable:2,minAnswers:2});
module.exports={
 ids:['gifts','photography','wedding','saas','event-readiness','retail-readiness'],
 titles:{
  gifts:['Explore practical gifts','Explore experience gifts','Explore personalized gifts','You can make this thoughtful without guessing today'],
  photography:['Explore portrait sessions','Explore brand photography','Explore event coverage','A clearer brief can come before a session choice'],
  wedding:['Explore coordination support','Explore partial planning','Explore full planning','You can explore support without deciding today'],
  saas:['Start with a quick-start guide','Try a guided tutorial','Explore setup support','You can explore before choosing a support path'],
  'event-readiness':['Choose one foundation to strengthen','Make the useful habits repeatable','Review and refine','Confirm a few details before judging readiness'],
  'retail-readiness':['Choose one foundation to strengthen','Make the useful habits repeatable','Review and refine','A few observed checks will make this useful'],
 },
 matching:[
  {name:'Every first preference',choices:['a0','a0','a0','a0'],next:'a0',status:'matched',resultId:'path0',score:null,titleIndex:0,categories:[],sections:['campaign-path0',...common]},
  {name:'Every second preference',choices:['a1','a1','a1','a1'],next:'a0',status:'matched',resultId:'path1',score:null,titleIndex:1,categories:[],sections:['campaign-path1',...common]},
  {name:'Every third preference',choices:['a2','a2','a2','a2'],next:'a0',status:'matched',resultId:'path2',score:null,titleIndex:2,categories:[],sections:['campaign-path2',...common]},
  {name:'Explore with no purchase commitment',choices:['a1','a1','a1','a1'],next:'a1',status:'matched',resultId:'path1',score:null,titleIndex:1,categories:[],sections:['campaign-path1',...common]},
  {name:'All preferences unsure',choices:['a3','a3','a3','a3'],next:'a0',status:'no_match',resultId:null,score:null,titleIndex:3,categories:[],sections:common},
  {name:'Explicit stop overrides otherwise strong third result',choices:['a2','a2','a2','a2'],next:'a2',status:'no_match',resultId:null,score:null,titleIndex:3,categories:[],sections:common},
  {name:'Equal two-point routes keep original tie order',choices:['a3','a0','a1','a3'],next:'a0',status:'matched',resultId:'path0',score:null,titleIndex:0,categories:[],sections:['campaign-path0',...common]},
 ],
 scorecards:[
  {name:'All not-yet',choices:['a2','a2','a2','a2','a2','a2'],status:'scored',resultId:'foundation',score:0,titleIndex:0,categories:[cat('area0',0,2),cat('area1',0,2),cat('area2',0,2)],sections:['campaign-foundation',...common]},
  {name:'All partly',choices:['a1','a1','a1','a1','a1','a1'],status:'scored',resultId:'consistent',score:50,titleIndex:1,categories:[cat('area0',50,2),cat('area1',50,2),cat('area2',50,2)],sections:['campaign-consistent',...common]},
  {name:'All consistent',choices:['a0','a0','a0','a0','a0','a0'],status:'scored',resultId:'refine',score:100,titleIndex:2,categories:[cat('area0',100,2),cat('area1',100,2),cat('area2',100,2)],sections:['campaign-refine',...common]},
  {name:'Low middle and high areas stay visible together',choices:['a2','a2','a1','a1','a0','a0'],status:'scored',resultId:'consistent',score:50,titleIndex:1,categories:[cat('area0',0,2),cat('area1',50,2),cat('area2',100,2)],sections:['campaign-consistent',...common]},
  {name:'All unknown',choices:['a3','a3','a3','a3','a3','a3'],status:'no_match',resultId:null,score:null,titleIndex:3,categories:[cat('area0',null,0),cat('area1',null,0),cat('area2',null,0)],sections:common},
  {name:'Unknown first area keeps overall incomplete',choices:['a3','a3','a0','a0','a0','a0'],status:'scored',resultId:null,score:null,titleIndex:null,categories:[cat('area0',null,0),cat('area1',100,2),cat('area2',100,2)],sections:common},
  {name:'One answered check is visible below the required coverage',choices:['a0','a3','a1','a1','a2','a2'],status:'scored',resultId:null,score:null,titleIndex:null,categories:[cat('area0',null,1),cat('area1',50,2),cat('area2',0,2)],sections:common},
  {name:'Different values within an area preserve the earned denominator',choices:['a0','a2','a1','a0','a2','a1'],status:'scored',resultId:'consistent',score:50,titleIndex:1,categories:[cat('area0',50,2),cat('area1',75,2),cat('area2',25,2)],sections:['campaign-consistent',...common]},
 ],
 answers(form,expected){return Object.fromEntries(form.questions.map((q,index)=>[q.id,q.id==='next'?expected.next:expected.choices[index]]));}
};
