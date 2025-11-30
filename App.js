import React from 'react';
import { NavigationContainer } from '@react-navigation/native';
import { createStackNavigator } from '@react-navigation/stack';
import Login from './Login';
import Home from './Home';
import ProfilePage from './Profile';
import Conversations from './Conversations';
import Chat from './Chat';
import SubmitProof from './SubmitProof';

const Stack = createStackNavigator();

export default function App() {
  return (
    <NavigationContainer>
      <Stack.Navigator>
        <Stack.Screen
          name="Login"
          component={Login}
          options={{ headerShown: false }}
        />
        <Stack.Screen
          name="Home"
          component={Home}
          options={{ title: 'Ana Sayfa' }}
        />
        <Stack.Screen
          name="Profile"
          component={ProfilePage}
          options={{ title: 'Profil' }}
        />
        <Stack.Screen
          name="Conversations"
          component={Conversations}
          options={{ title: 'Sohbetler' }}
        />
        <Stack.Screen
          name="Chat"
          component={Chat}
          options={{ title: 'Sohbet' }}
        />
        <Stack.Screen
          name="SubmitProof"
          component={SubmitProof}
          options={{ title: 'Kanıt Gönder' }}
        />
      </Stack.Navigator>
    </NavigationContainer>
  );
}