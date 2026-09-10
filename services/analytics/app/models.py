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
class GenerateRequest(BaseModel): dataset:Dataset; strategy:str="uniform"; count:int=Field(ge=1,le=100); pick_count:int; seed:int; fixed:list[int]=[]; excluded:list[int]=[]; max_overlap:int|None=None
class BacktestRequest(BaseModel): dataset:Dataset; strategy:str="uniform"; tickets_per_contest:int=Field(ge=1,le=100); pick_count:int; seeds:list[int]; min_training:int=Field(default=25,ge=1)
