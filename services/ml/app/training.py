from __future__ import annotations
import numpy as np
import tensorflow as tf
from .model_store import save_model
from .settings import settings

def windows(values: np.ndarray, size: int):
    return np.stack([values[i:i+size] for i in range(len(values)-size+1)])

def train(series: list[float], key: str, epochs: int=20):
    raw=np.asarray(series,dtype=np.float32); mean=float(raw.mean()); std=max(float(raw.std()),1e-6)
    normalized=(raw-mean)/std; size=min(settings.window_size,max(8,len(raw)//4)); x=windows(normalized,size)[...,None]
    inputs=tf.keras.Input(shape=(size,1))
    h=tf.keras.layers.Flatten()(inputs)
    h=tf.keras.layers.Dense(max(8,size//2),activation="relu")(h)
    h=tf.keras.layers.Dense(max(4,size//4),activation="relu")(h)
    h=tf.keras.layers.Dense(max(8,size//2),activation="relu")(h)
    h=tf.keras.layers.Dense(size)(h)
    outputs=tf.keras.layers.Reshape((size,1))(h)
    model=tf.keras.Model(inputs,outputs)
    model.compile(optimizer=tf.keras.optimizers.Adam(learning_rate=1e-3),loss="mse")
    history=model.fit(x,x,epochs=epochs,batch_size=min(64,max(8,len(x)//8)),validation_split=0.15,verbose=0,shuffle=True)
    recon=model.predict(x,verbose=0); errors=np.mean(np.square(recon-x),axis=(1,2))
    threshold=float(np.quantile(errors,0.995)*1.25)
    meta={"window_size":size,"mean":mean,"std":std,"threshold":threshold,"training_windows":int(len(x))}
    save_model(key,model,meta)
    return {"modelKey":key,"windows":int(len(x)),"threshold":threshold,"finalLoss":float(history.history["loss"][-1])}
