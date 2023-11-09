const graphql = require("graphql");
const bcrypt = require("bcrypt");

const jwtSecret = "secret-key";
const Task = require("../models/task");
const User = require("../models/user");
const AuthService = require("../services/AuthService.js");

const saltRounds = 10;
const authService = new AuthService(jwtSecret);

const {
  GraphQLObjectType,
  GraphQLString,
  GraphQLSchema,
  GraphQLID,
  GraphQLList,
  GraphQLBoolean,
  GraphQLNonNull,
  GraphQLInputObjectType,
} = graphql;

const TasksType = new GraphQLObjectType({
  name: "Task",
  fields: () => ({
    id: { type: GraphQLID },
    title: { type: GraphQLString },
    description: { type: GraphQLString },
    tags: { type: new GraphQLList(GraphQLString) },
    done: { type: GraphQLBoolean, defaultValue: false },
    userId: { type: GraphQLID },
    author: {
      type: UserType,
      resolve(parent, args) {
        return User.findById(parent.userId);
      },
    },
  }),
});
const UserType = new GraphQLObjectType({
  name: "User",
  fields: () => ({
    id: { type: GraphQLID },
    firstname: { type: GraphQLString },
    lastname: { type: GraphQLString },
    email: { type: GraphQLString },
    password: { type: GraphQLString },
    tasks: {
      type: new GraphQLList(TasksType),
      resolve(parent, args) {
        return Task.find({ userId: parent.id });
      },
    },
  }),
});
const AuthResponseType = new GraphQLObjectType({
  name: "AuthResponse",
  fields: () => ({
    token: { type: GraphQLString },
    message: { type: GraphQLString },
  }),
});

const RootQuery = new GraphQLObjectType({
  name: "RootQueryType",
  fields: {
    getTodoTasks: {
      type: new GraphQLList(TasksType),
      args: { userId: { type: GraphQLID } },
      async resolve(parent, args) {
        return await Task.find({ userId: args.userId, done: false });
      },
    },
    getDoneTasks: {
      type: new GraphQLList(TasksType),
      args: { userId: { type: GraphQLID } },
      async resolve(parent, args) {
        return await Task.find({ userId: args.userId, done: true });
      },
    },
    getTask: {
      type: TasksType,
      args: { id: { type: GraphQLID } },
      async resolve(parent, args) {
        return await Task.findById(args.id);
      },
    },
    findTasks: {
      type: new GraphQLList(TasksType),
      args: {
        tags: {
          type: new GraphQLNonNull(new GraphQLList(GraphQLString)),
        },
        userId: { type: GraphQLID },
      },
      async resolve(parent, args) {
        const tasks = await Task.find({
          tags: { $in: args.tags },
          userId: args.userId,
        });
        return tasks;
      },
    },
  },
});
const CreateTaskInputType = new GraphQLInputObjectType({
  name: "CreateTaskInput",
  fields: () => ({
    title: { type: new GraphQLNonNull(GraphQLString) },
    description: { type: new GraphQLNonNull(GraphQLString) },
    tags: { type: new GraphQLNonNull(new GraphQLList(GraphQLString)) },
    done: { type: GraphQLBoolean },
  }),
});
const UpdateTaskInputType = new GraphQLInputObjectType({
  name: "UpdateTaskInput",
  fields: () => ({
    title: { type: GraphQLString },
    description: { type: GraphQLString },
    tags: { type: new GraphQLList(GraphQLString) },
    done: { type: GraphQLBoolean },
  }),
});

const Mutation = new GraphQLObjectType({
  name: "Mutation",
  fields: {
    addUser: {
      type: UserType,
      args: {
        firstname: { type: new GraphQLNonNull(GraphQLString) },
        lastname: { type: new GraphQLNonNull(GraphQLString) },
        email: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        let user = new User({
          firstname: args.firstname,
          lastname: args.lastname,
          email: args.email,
          password: await bcrypt.hash(args.password, saltRounds),
        });
        return user.save();
      },
    },
    login: {
      type: AuthResponseType,
      args: {
        email: { type: new GraphQLNonNull(GraphQLString) },
        password: { type: new GraphQLNonNull(GraphQLString) },
      },
      async resolve(parent, args) {
        const { email, password } = args;
        const token = await authService.loginUser(email, password);

        return { token, message: "Login successful" };
      },
    },
    createTask: {
      type: TasksType,
      args: {
        input: { type: new GraphQLNonNull(CreateTaskInputType) },
      },
      resolve: async (parent, args, { user }) => {
        console.log(user);
        if (!user) {
          throw new Error("Authentication required");
        }

        const userId = user.id;

        const task = new Task({
          title: args.input.title,
          description: args.input.description,
          tags: args.input.tags,
          done: args.input.done !== undefined ? args.input.done : false,
          userId,
        });

        return await task.save();
      },
    },

    updateTask: {
      type: TasksType,
      args: {
        id: { type: GraphQLID },
        input: { type: UpdateTaskInputType },
      },
      resolve: async (parent, args) => {
        try {
          const updateFields = {};
          if (args.input.title) {
            updateFields.title = args.input.title;
          }
          if (args.input.description) {
            updateFields.description = args.input.description;
          }
          if (args.input.done) {
            updateFields.done = args.input.done;
          }
          if (args.input.tags) {
            updateFields.tags = args.input.tags;
          }
          const updatedTask = await Task.findOneAndUpdate(
            { _id: args.id },
            { $set: updateFields },
            { new: true }
          );

          if (!updatedTask) {
            throw new Error("Task not found");
          }

          return updatedTask;
        } catch (error) {
          throw new Error(`Error updating task: ${error.message}`);
        }
      },
    },

    deleteTask: {
      type: TasksType,
      args: { id: { type: GraphQLID } },
      resolve: async (parent, args) => {
        try {
          const deletedTask = await Task.findOneAndDelete({ _id: args.id });
          if (!deletedTask) {
            throw new Error("Task not found");
          }
          return deletedTask;
        } catch (error) {
          throw new Error(`Error deleting task: ${error.message}`);
        }
      },
    },
  },
});
module.exports = new GraphQLSchema({
  query: RootQuery,
  mutation: Mutation,
});
