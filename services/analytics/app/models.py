from pydantic import BaseModel, Field, model_validator
class Dataset(BaseModel):
 lottery: str
 universe: int=Field(gt=1)
 drawn_count: int=Field(gt=0)
 contest_numbers: list[int]
 draws: list[list[int]]
 dataset_hash: str
 @model_validator(mode="after")
 def validate_draws(self):
  if self.drawn_count>=self.universe: raise ValueError("drawn_count must be below universe")
  if len(self.draws)!=len(self.contest_numbers): raise ValueError("draw and contest lengths differ")
  for draw in self.draws:
   if len(draw)!=self.drawn_count or len(set(draw))!=len(draw) or any(n<1 or n>self.universe for n in draw): raise ValueError("invalid draw")
  return self
class AnalyzeRequest(BaseModel): dataset: Dataset; windows:list[int]=[10,25,50,100,250]
class GenerateRequest(BaseModel):
 dataset:Dataset
 strategy:str="uniform"
 count:int=Field(ge=1,le=100)
 pick_count:int
 seed:int
 fixed:list[int]=[]
 excluded:list[int]=[]
 max_overlap:int|None=None
 window:int=Field(default=50,ge=1,le=500)
 alpha:float=Field(default=10,gt=0,le=100)
 tau:float=Field(default=1,ge=0,le=3)
 reference_size:int=Field(default=2000,ge=200,le=10000)
 base_strategy:str="recent-frequency"
class BacktestRequest(BaseModel): dataset:Dataset; strategy:str="uniform"; tickets_per_contest:int=Field(ge=1,le=100); pick_count:int; seeds:list[int]; min_training:int=Field(default=25,ge=1)
