import tensorflow as tf
# import keras

import numpy as np
import os
import time
import json
import pickle


# --- Train config ---

# number of epochs
EPOCHS = 10
# The maximum length sentence you want for a single input in characters
seq_length = 100


def split_input_target(chunk):
    input_text = chunk[:-1]
    target_text = chunk[1:]
    return input_text, target_text


def build_model(vocab_size, embedding_dim, rnn_units, batch_size):
    model = tf.keras.Sequential([
        tf.keras.layers.Embedding(
            vocab_size, embedding_dim,
            batch_input_shape=[batch_size, None]
        ),
        tf.keras.layers.GRU(
            rnn_units,
            return_sequences=True,
            stateful=True,
            recurrent_initializer='glorot_uniform'
        ),
        tf.keras.layers.Dense(vocab_size)
    ])
    return model


# Attach the optimizer and loss function
def loss(labels, logits):
    return tf.keras.losses.sparse_categorical_crossentropy(labels, logits, from_logits=True)


def generate_text(model, start_string):
    # Evaluation step (generating text using the learned model)

    # Number of characters to generate
    num_generate = 1000

    # Converting our start string to numbers (vectorizing)
    input_eval = [char2idx[input_] for input_ in start_string]
    input_eval = tf.expand_dims(input_eval, 0)

    # Empty string to store our results
    text_generated = []

    # Low temperature results in more predictable text.
    # Higher temperature results in more surprising text.
    # Experiment to find the best setting.
    temperature = 1.0

    # Here batch size == 1
    model.reset_states()
    for _ in range(num_generate):
        predictions = model(input_eval)
        # remove the batch dimension
        predictions = tf.squeeze(predictions, 0)

        # using a categorical distribution to predict the character returned by the model
        predictions = predictions / temperature
        predicted_id = tf.random.categorical(predictions, num_samples=1)[-1,0].numpy()

        # Pass the predicted character as the next input to the model
        # along with the previous hidden state
        input_eval = tf.expand_dims([predicted_id], 0)

        text_generated.append(idx2char[predicted_id])

    return (start_string + ''.join(text_generated))


# Read, then decode for py2 compat.
# text = open(path_to_file, 'rb').read().decode(encoding='utf-8')
text = open('dataset_clear.txt', 'rb').read().decode(encoding='utf-8')
# length of text is the number of characters in it
# print('Length of text: {} characters'.format(len(text)))


# The unique characters in the file
vocab = sorted(set(text))
# print('{} unique characters'.format(len(vocab)))


# Creating a mapping from unique characters to indices
char2idx = {u:i for i, u in enumerate(vocab)}
idx2char = np.array(vocab)

text_as_int = np.array([char2idx[c] for c in text])

# show integer representation for each character
# print('{')
# for char,_ in zip(char2idx, range(20)):
#     print('  {:4s}: {:3d},'.format(repr(char), char2idx[char]))
# print('  ...\n}')


# Show how the first 13 characters from the text are mapped to integers
# print('{} ---- characters mapped to int ---- > {}'.format(repr(text[:13]), text_as_int[:13]))


# The maximum length sentence you want for a single input in characters (!)
# seq_length = 100
examples_per_epoch = len(text)//(seq_length+1)

# Create training examples / targets
char_dataset = tf.data.Dataset.from_tensor_slices(text_as_int)

# for i in char_dataset.take(5):
#     print(idx2char[i.numpy()])


sequences = char_dataset.batch(seq_length+1, drop_remainder=True)

# for item in sequences.take(5):
#     print(repr(''.join(idx2char[item.numpy()])))

dataset = sequences.map(split_input_target)

# ---

# Batch size
BATCH_SIZE = 64

# Buffer size to shuffle the dataset
# (TF data is designed to work with possibly infinite sequences,
# so it doesn't attempt to shuffle the entire sequence in memory. Instead,
# it maintains a buffer in which it shuffles elements).
BUFFER_SIZE = 10000

dataset = dataset.shuffle(BUFFER_SIZE).batch(BATCH_SIZE, drop_remainder=True)


is_need_train: bool = None
while True:
    input_ = input('Train model (y/n)? ')
    if input_ == 'y':
        is_need_train = True
        break
    elif input_ == 'n':
        is_need_train = False
        break
    else:
        continue

if is_need_train:
    # --- Build the model ---

    # Length of the vocabulary in chars
    vocab_size = len(vocab)

    # The embedding dimension
    embedding_dim = 256

    # Number of RNN units
    rnn_units = 1024

    # ---

    model = build_model(
        vocab_size=len(vocab),
        embedding_dim=embedding_dim,
        rnn_units=rnn_units,
        batch_size=BATCH_SIZE)

    # ---

    for input_example_batch, target_example_batch in dataset.take(1):
        example_batch_predictions = model(input_example_batch)
        # print(example_batch_predictions.shape, "# (batch_size, sequence_length, vocab_size)")

    # ---

    # model.summary()

    # ---

    sampled_indices = tf.random.categorical(example_batch_predictions[0], num_samples=1)
    sampled_indices = tf.squeeze(sampled_indices,axis=-1).numpy()

    # ---

    # print(sampled_indices)

    # ---

    # show text predicted by untrained model
    # print("Input: \n", repr("".join(idx2char[input_example_batch[0]])))
    # print()
    # print("Next Char Predictions: \n", repr("".join(idx2char[sampled_indices])))

    # --- Train the model ---

    example_batch_loss = loss(target_example_batch, example_batch_predictions)
    print("Prediction shape: ", example_batch_predictions.shape, " # (batch_size, sequence_length, vocab_size)")
    print("scalar_loss:      ", example_batch_loss.numpy().mean())

    # ---

    model.compile(optimizer='adam', loss=loss)

    # --- Configure checkpoints ---

    # Directory where the checkpoints will be saved
    checkpoint_dir = './training_checkpoints'
    # Name of the checkpoint files
    checkpoint_prefix = os.path.join(checkpoint_dir, "ckpt_{epoch}")

    checkpoint_callback = tf.keras.callbacks.ModelCheckpoint(
        filepath=checkpoint_prefix,
        save_weights_only=True
    )

    # --- Execute the training ---

    # Number of epochs (!)
    # EPOCHS = 10

    # Do train (!)
    history = model.fit(dataset, epochs=EPOCHS, callbacks=[checkpoint_callback])

    # --- Set checkpoints ---

    checkpoint_dir = './training_checkpoints'

    tf.train.latest_checkpoint(checkpoint_dir)

    # ---

    model = build_model(vocab_size, embedding_dim, rnn_units, batch_size=1)

    model.load_weights(tf.train.latest_checkpoint(checkpoint_dir))

    model.build(tf.TensorShape([1, None]))

    # --- Save model ---

    dir_list = os.listdir('models')
    # if dir is empty
    if len(dir_list) == 0:
        model_id = 1
    else:
        # model filename format: 'model_{id}.h5'
        model_id_list = list(map(lambda fn: int(fn.split('_')[1].split('.')[0]), dir_list))
        last_id = max(model_id_list)
        model_id = last_id + 1
    # open(f"models/model_{model_id}", 'w')
    model.save(f"models/model_{model_id}.h5") # .HDF5 file
    print(f"Model 'model_{model_id}.h5' saved.")


# --- Generate text ---
CURRENT_TASK = 'TEXT GEN'
dir_list = os.listdir('models')
# if dir is empty
if len(dir_list) == 0:
    print(f'[{CURRENT_TASK}] No models.')
else:
    model_id = input(f'[{CURRENT_TASK}] Enter model id: ')
    # if model not exist
    if not os.path.isfile(f'models/model_{model_id}.h5'):
        print(f'[{CURRENT_TASK}] Model not found.')
    else:
        model = tf.keras.models.load_model(f'models/model_{model_id}.h5')
        text = generate_text(model, start_string=u'A')
        text = text.replace('\n', '\n\n')
        print(f'[{CURRENT_TASK}] Output:')
        print(text)


# print(generate_text(model, start_string=u"A"))
# generated_text = generate_text(model, start_string=u"A")
# print(generated_text.replace('\n', '\n\n'))

