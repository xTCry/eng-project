# import json
import os
# import keras

""" >>> from datetime import datetime
>>> datetime.now().strftime('%d.%m.%Y-%H:%M:%S')
'24.12.2020-02:55:07'
>>> datetime.now().strftime('%d.%m.%Y+%H:%M:%S')
'24.12.2020+02:55:15'
>>> datetime.now().strftime('%d.%m.%Y_%H:%M:%S')
'24.12.2020_02:55:18'
>>> datetime.now().strftime('%d.%m.%Y-%H:%M:%S')
'24.12.2020-02:55:51'
>>> datetime.now().strftime('%d.%m.%Y-%H.%M.%S')
'24.12.2020-02.56.18' """

# with open('var_dump/char2idx.json', 'r') as f:
#     char2idx = f.read()
# with open('var_dump/char2idx.pkl', 'rb') as f:
#     char2idx = f.read()

# print(char2idx)
# for i in char2idx:
#     print(i)

# isSome: bool = None
# while True:
#     s = input('Train model (y/n)? ')
#     if s == 'y':
#         isSome = True
#         break
#     elif s == 'n':
#         isSome = False
#         break
#     else:
#         continue
# print(isSome)
    
# for i in [1,2,3]:
#     open(f'models/model_{i}', 'w')


# dir_list = os.listdir('models')
# file_id_list = list(map(lambda fn: fn.split('_')[1], dir_list))
# print(max(file_id_list))


# dir_list = os.listdir('models')
# # if dir is empty
# if len(dir_list) == 0:
#     model_id = 1
# else:
#     model_id_list = list(map(lambda fn: int(fn.split('_')[1]), dir_list))
#     last_id = max(model_id_list)
#     model_id = last_id + 1
# open(f"models/model_{model_id}", 'w')
# print(f"models/model_{model_id}")
