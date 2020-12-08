import keras
from keras import preprocessing
import tensorflow
from textgenrnn import textgenrnn
# import pandas as pd
import cyrtranslit

textgen = textgenrnn()
# textgen.train_from_file('dataset')
text = open('datasets/wim.txt')
text = cyrtranslit.to_latin(text, 'ru')
print(text[:200])